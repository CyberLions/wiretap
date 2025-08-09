const axios = require('axios');
const http = require('http');
const https = require('https');
const { openstackConfig } = require('../utils/config');
const { update } = require('../utils/db');

// OpenStack authentication cache
const authCache = new Map();

// Small cache for Keystone project ID lookups (per provider + project name)
const projectIdCache = new Map();
const PROJECT_ID_TTL_MS = parseInt(process.env.OPENSTACK_PROJECT_ID_TTL_MS || '', 10) || (5 * 60 * 1000);

// Shared Axios instance with keep-alive agents
const axiosInstance = axios.create({
  timeout: openstackConfig.connectionTimeout,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 10_000 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 10_000 })
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientNetworkError(error) {
  if (!error) return false;
  const code = error.code || error.errno;
  const transientCodes = [
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ECONNREFUSED',
    'EPIPE',
    'ESOCKETTIMEDOUT'
  ];
  return transientCodes.includes(code);
}

/**
 * If provider has proxy_through_host set, rewrite the request URL host to the proxy
 * while preserving the original Host header for upstream routing. This allows
 * routing through a DNS/IP (e.g., pritunl-proxy.pritunl) without changing
 * service discovery semantics.
 */
function buildProxiedRequest(urlString, provider) {
  if (!provider?.proxy_through_host) {
    return { url: urlString, headers: {} };
  }
  try {
    const original = new URL(urlString);
    const originalHostHeader = original.host; // includes port if present
    // Replace only the hostname; preserve protocol and port
    original.hostname = provider.proxy_through_host;
    return {
      url: original.toString(),
      headers: { Host: originalHostHeader }
    };
  } catch (e) {
    // If parsing fails, fallback to original
    return { url: urlString, headers: {} };
  }
}

/**
 * Get OpenStack authentication token and service catalog
 */
function getProviderAuthCacheKey(provider) {
  return `${provider.id}_${provider.auth_url}`;
}

function getProjectAuthCacheKey(provider, projectName) {
  return `${provider.id}_${provider.auth_url}_${projectName}`;
}

function invalidateAuthCache(cacheKey) {
  if (authCache.has(cacheKey)) {
    authCache.delete(cacheKey);
  }
}

async function getAuthToken(provider) {
  const cacheKey = getProviderAuthCacheKey(provider);
  
  // Check cache first
  if (authCache.has(cacheKey)) {
    const cached = authCache.get(cacheKey);
    if (Date.now() < cached.expires) {
      return cached;
    }
  }
  
  try {
    // Construct auth URL like compsole does - append identity version
    const identityVersion = provider.identity_version || 'v3';
    const authUrl = provider.auth_url.endsWith('/') 
      ? `${provider.auth_url}${identityVersion}`
      : `${provider.auth_url}/${identityVersion}`;
    
    const authData = {
      auth: {
        identity: {
          methods: ['password'],
          password: {
            user: {
              name: provider.username,
              password: provider.password,
              domain: {
                name: provider.domain_name || 'Default'
              }
            }
          }
        },
        scope: {
          project: {
            name: provider.project_name,
            domain: {
              name: provider.domain_name || 'Default'
            }
          }
        }
      }
    };
    
    const { url: authTargetUrl, headers: proxyHeaders } = buildProxiedRequest(`${authUrl}/auth/tokens`, provider);
    const response = await axiosInstance.post(
      authTargetUrl,
      authData,
      {
        headers: {
          'Content-Type': 'application/json',
          ...proxyHeaders
        },
        timeout: openstackConfig.connectionTimeout
      }
    );
    
    const token = response.headers['x-subject-token'];
    const expires = new Date(response.data.token.expires_at);
    const serviceCatalog = response.data.token.catalog;
    
    // Cache auth data
    const cachedAuthData = {
      token,
      expires: expires.getTime(),
      serviceCatalog
    };
    
    authCache.set(cacheKey, cachedAuthData);
    
    return cachedAuthData;
  } catch (error) {
    console.error('OpenStack authentication error:', error.message);
    throw new Error('Failed to authenticate with OpenStack');
  }
}

/**
 * Make authenticated request to OpenStack API
 */
async function makeRequest(provider, endpoint, method = 'GET', data = null) {
  const region = provider.region_name || openstackConfig.defaultRegion;
  const maxRetries = Number.isFinite(openstackConfig.maxRetries) ? openstackConfig.maxRetries : 3;
  const cacheKey = getProviderAuthCacheKey(provider);

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const authData = await getAuthToken(provider);

      const computeService = authData.serviceCatalog.find(service => service.type === 'compute');
      if (!computeService) {
        throw new Error('Compute service not found in service catalog');
      }

      const computeEndpoint = computeService.endpoints.find(ep => ep.interface === 'public' && ep.region === region);
      if (!computeEndpoint) {
        throw new Error(`Compute endpoint not found for region: ${region}`);
      }

      const { url: targetUrl, headers: proxyHeaders } = buildProxiedRequest(`${computeEndpoint.url}${endpoint}`, provider);
      const response = await axiosInstance({
        method,
        url: targetUrl,
        headers: {
          'X-Auth-Token': authData.token,
          'Content-Type': 'application/json',
          'OpenStack-API-Version': 'compute 2.8',
          ...proxyHeaders
        },
        data
      });

      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      // Handle 401 by invalidating token and retrying once per attempt chain
      if (status === 401) {
        invalidateAuthCache(cacheKey);
        lastError = error;
        if (attempt < maxRetries) {
          await sleep(150 * (attempt + 1));
          continue;
        }
      }

      // Retry transient or 5xx errors with backoff
      if (status >= 500 || isTransientNetworkError(error)) {
        lastError = error;
        if (attempt < maxRetries) {
          const backoffMs = Math.min(2000, 300 * Math.pow(2, attempt));
          await sleep(backoffMs);
          continue;
        }
      }

      // Non-retryable
      throw new Error(`OpenStack API request failed: ${error.message || String(error)}`);
    }
  }

  throw new Error(`OpenStack API request failed after retries: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Test OpenStack connection
 */
async function testOpenStackConnection(provider) {
  try {
    await getAuthToken(provider);
    
    // Try to list projects using identity service
    const identityVersion = provider.identity_version || 'v3';
    const authUrl = provider.auth_url.endsWith('/') 
      ? `${provider.auth_url}${identityVersion}`
      : `${provider.auth_url}/${identityVersion}`;
    
    const authData = await getAuthToken(provider);
    const { url: targetUrl, headers: proxyHeaders } = buildProxiedRequest(`${authUrl}/projects`, provider);
    const response = await axiosInstance.get(
      targetUrl,
      {
        headers: {
          'X-Auth-Token': authData.token,
          'Content-Type': 'application/json',
          ...proxyHeaders
        },
        timeout: openstackConfig.connectionTimeout
      }
    );
    
    return {
      success: true,
      message: 'Connection successful',
      projects: response.data.projects || []
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get OpenStack project ID by name
 */
async function getOpenStackProjectId(provider, projectName) {
  try {
    // Check memoized cache first
    const projCacheKey = `${provider.id}:${provider.auth_url}:${projectName}`;
    const cached = projectIdCache.get(projCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.projectId;
    }
    const identityVersion = provider.identity_version || 'v3';
    const authUrl = provider.auth_url.endsWith('/') 
      ? `${provider.auth_url}${identityVersion}`
      : `${provider.auth_url}/${identityVersion}`;
    
    const authData = await getAuthToken(provider);
    const { url: targetUrl, headers: proxyHeaders } = buildProxiedRequest(`${authUrl}/projects`, provider);
    const response = await axiosInstance.get(
      targetUrl,
      {
        headers: {
          'X-Auth-Token': authData.token,
          'Content-Type': 'application/json',
          ...proxyHeaders
        },
        timeout: openstackConfig.connectionTimeout
      }
    );
    
    const project = response.data.projects.find(p => p.name === projectName);
    const projectId = project ? project.id : null;

    // Store in cache with TTL
    projectIdCache.set(projCacheKey, { projectId, expiresAt: Date.now() + PROJECT_ID_TTL_MS });
    return projectId;
  } catch (error) {
    console.error('Error getting project ID:', error);
    return null;
  }
}

/**
 * List all instances in a project
 */
async function listInstances(provider, projectId) {
  try {
    // Note: consider adding pagination if large projects are expected
    const instances = await makeRequest(provider, `/servers/detail?project_id=${projectId}`);
    return instances.servers || [];
  } catch (error) {
    console.error('Error listing instances:', error);
    return [];
  }
}

/**
 * Get instance details
 */
async function getInstanceDetails(provider, instanceId) {
  try {
    // Get server details
    const serverResponse = await makeRequest(provider, `/servers/${instanceId}`);
    const server = serverResponse.server;
    
    // Extract IP addresses from the addresses field in server details
    const ipAddresses = [];
    if (server.addresses) {
      for (const networkName in server.addresses) {
        const networkAddresses = server.addresses[networkName];
        if (Array.isArray(networkAddresses)) {
          for (const addr of networkAddresses) {
            if (addr.addr && addr.type === 'fixed') {
              ipAddresses.push(addr.addr);
            }
          }
        }
      }
    }
    
    return {
      ...server,
      ip_addresses: ipAddresses
    };
  } catch (error) {
    console.error('Error getting instance details:', error);
    return null;
  }
}

/**
 * Get instance status
 */
async function getInstanceStatus(provider, instance) {
  try {
    const details = await getInstanceDetails(provider, instance.openstack_id);
    
    if (!details) {
      return {
        status: 'UNKNOWN',
        power_state: 'UNKNOWN'
      };
    }
    
    // Update database with latest status
    await update('instances', 'status', details.status, 'id', [instance.id]);
    await update('instances', 'power_state', details.power_state, 'id', [instance.id]);
    
    // Update IP addresses in database
    if (details.ip_addresses && details.ip_addresses.length > 0) {
      await update('instances', 'ip_addresses', JSON.stringify(details.ip_addresses), 'id', [instance.id]);
    }
    
    return {
      status: details.status,
      power_state: details.power_state,
      flavor: details.flavor?.name,
      image: details.image?.name,
      ip_addresses: details.ip_addresses
    };
  } catch (error) {
    console.error('Error getting instance status:', error);
    return {
      status: 'UNKNOWN',
      power_state: 'UNKNOWN'
    };
  }
}

/**
 * Power on instance
 */
async function powerOnInstance(provider, instance) {
  try {
    await makeRequest(provider, `/servers/${instance.openstack_id}/action`, 'POST', {
      'os-start': null
    });
    
    // Update database
    await update('instances', 'power_state', 'RUNNING', 'id', [instance.id]);
    
    return true;
  } catch (error) {
    console.error('Error powering on instance:', error);
    throw new Error('Failed to power on instance');
  }
}

/**
 * Power off instance
 */
async function powerOffInstance(provider, instance) {
  try {
    await makeRequest(provider, `/servers/${instance.openstack_id}/action`, 'POST', {
      'os-stop': null
    });
    
    // Update database
    await update('instances', 'power_state', 'SHUTDOWN', 'id', [instance.id]);
    
    return true;
  } catch (error) {
    console.error('Error powering off instance:', error);
    throw new Error('Failed to power off instance');
  }
}

/**
 * Restart instance
 */
async function restartInstance(provider, instance, hard = false) {
  try {
    let data;
    if (hard) {
      // For hard reboot, use the hard reboot action
      data = { reboot: { type: 'HARD' } };
    } else {
      // For soft reboot, use the soft reboot action
      data = { reboot: { type: 'SOFT' } };
    }
    
    await makeRequest(provider, `/servers/${instance.openstack_id}/action`, 'POST', data);
    
    return true;
  } catch (error) {
    console.error('Error restarting instance:', error);
    throw new Error('Failed to restart instance');
  }
}

/**
 * Force HTTPS for console URLs to prevent mixed content errors
 */
function forceHttpsForConsoleUrl(url, consoleType) {
  if (!url) return url;
  
  // Force HTTPS for VNC/NoVNC URLs to prevent mixed content errors
  if ((consoleType.toUpperCase() === 'VNC' || consoleType.toUpperCase() === 'NOVNC') && url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  
  return url;
}

/**
 * Get console URL for instance
 */
async function getConsoleUrl(provider, instance, consoleType = 'NOVNC') {
  try {
    // Map console types to OpenStack remote console types (matching compsole)
    let protocol, type;
    switch (consoleType.toUpperCase()) {
      case 'SERIAL':
        protocol = 'serial';
        type = 'serial';
        break;
      case 'SPICE':
        protocol = 'spice';
        type = 'spice-html5';
        break;
      case 'RDP':
        protocol = 'rdp';
        type = 'rdp-html5';
        break;
      case 'MKS':
        protocol = 'mks';
        type = 'webmks';
        break;
      case 'NOVNC':
      case 'VNC':
      default:
        protocol = 'vnc';
        type = 'novnc';
        break;
    }

    const response = await makeRequest(provider, `/servers/${instance.openstack_id}/remote-consoles`, 'POST', {
      remote_console: {
        protocol: protocol,
        type: type
      }
    });
    
    let consoleUrl = response.remote_console?.url;
    
    // Force HTTPS for VNC URLs to prevent mixed content errors
    consoleUrl = forceHttpsForConsoleUrl(consoleUrl, consoleType);
    
    // Add auto-scaling to NoVNC URLs like compsole does
    if ((consoleType.toUpperCase() === 'VNC' || consoleType.toUpperCase() === 'NOVNC') && consoleUrl && !consoleUrl.includes('scale=true')) {
      consoleUrl += '&scale=true';
    }
    
    return consoleUrl;
  } catch (error) {
    console.error('Error getting console URL:', error);
    return null;
  }
}

/**
 * Get console URL for instance using project-specific authentication
 */
async function getConsoleUrlForProject(provider, projectName, instance, consoleType = 'NOVNC') {
  try {
    // Map console types to OpenStack remote console types (matching compsole)
    let protocol, type;
    switch (consoleType.toUpperCase()) {
      case 'SERIAL':
        protocol = 'serial';
        type = 'serial';
        break;
      case 'SPICE':
        protocol = 'spice';
        type = 'spice-html5';
        break;
      case 'RDP':
        protocol = 'rdp';
        type = 'rdp-html5';
        break;
      case 'MKS':
        protocol = 'mks';
        type = 'webmks';
        break;
      case 'NOVNC':
      case 'VNC':
      default:
        protocol = 'vnc';
        type = 'novnc';
        break;
    }

    const response = await makeRequestForProject(provider, projectName, `/servers/${instance.openstack_id}/remote-consoles`, 'POST', {
      remote_console: {
        protocol: protocol,
        type: type
      }
    });
    
    let consoleUrl = response.remote_console?.url;
    
    // Force HTTPS for VNC URLs to prevent mixed content errors
    consoleUrl = forceHttpsForConsoleUrl(consoleUrl, consoleType);
    
    // Add auto-scaling to NoVNC URLs like compsole does
    if ((consoleType.toUpperCase() === 'VNC' || consoleType.toUpperCase() === 'NOVNC') && consoleUrl && !consoleUrl.includes('scale=true')) {
      consoleUrl += '&scale=true';
    }
    
    return consoleUrl;
  } catch (error) {
    console.error('Error getting console URL for project:', error);
    return null;
  }
}

/**
 * Get OpenStack authentication token for a specific project
 */
async function getAuthTokenForProject(provider, projectName) {
  const cacheKey = getProjectAuthCacheKey(provider, projectName);
  
  // Check cache first
  if (authCache.has(cacheKey)) {
    const cached = authCache.get(cacheKey);
    if (Date.now() < cached.expires) {
      return cached;
    }
  }
  
  try {
    // Construct auth URL like compsole does - append identity version
    const identityVersion = provider.identity_version || 'v3';
    const authUrl = provider.auth_url.endsWith('/') 
      ? `${provider.auth_url}${identityVersion}`
      : `${provider.auth_url}/${identityVersion}`;
    
    const authData = {
      auth: {
        identity: {
          methods: ['password'],
          password: {
            user: {
              name: provider.username,
              password: provider.password,
              domain: {
                name: provider.domain_name || 'Default'
              }
            }
          }
        },
        scope: {
          project: {
            name: projectName,
            domain: {
              name: provider.domain_name || 'Default'
            }
          }
        }
      }
    };
    
    console.log(`Authenticating for project: ${projectName}`);
    console.log('authUrl', authUrl);
    
    const { url: authTargetUrl, headers: proxyHeaders } = buildProxiedRequest(`${authUrl}/auth/tokens`, provider);
    const response = await axiosInstance.post(
      authTargetUrl,
      authData,
      {
        headers: {
          'Content-Type': 'application/json',
          ...proxyHeaders
        },
        timeout: openstackConfig.connectionTimeout
      }
    );
    
    const token = response.headers['x-subject-token'];
    const expires = new Date(response.data.token.expires_at);
    const serviceCatalog = response.data.token.catalog;
    
    // Cache auth data
    const cachedAuthData = {
      token,
      expires: expires.getTime(),
      serviceCatalog
    };
    
    authCache.set(cacheKey, cachedAuthData);
    
    return cachedAuthData;
  } catch (error) {
    console.error(`OpenStack authentication error for project ${projectName}:`, error.message);
    throw new Error(`Failed to authenticate with OpenStack for project ${projectName}`);
  }
}

/**
 * Make authenticated request to OpenStack API for a specific project
 */
async function makeRequestForProject(provider, projectName, endpoint, method = 'GET', data = null) {
  const region = provider.region_name || openstackConfig.defaultRegion;
  const maxRetries = Number.isFinite(openstackConfig.maxRetries) ? openstackConfig.maxRetries : 3;
  const cacheKey = getProjectAuthCacheKey(provider, projectName);

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const authData = await getAuthTokenForProject(provider, projectName);

      const computeService = authData.serviceCatalog.find(service => service.type === 'compute');
      if (!computeService) {
        throw new Error('Compute service not found in service catalog');
      }

      const computeEndpoint = computeService.endpoints.find(ep => ep.interface === 'public' && ep.region === region);
      if (!computeEndpoint) {
        throw new Error(`Compute endpoint not found for region: ${region}`);
      }

      const { url: targetUrl, headers: proxyHeaders } = buildProxiedRequest(`${computeEndpoint.url}${endpoint}`, provider);
      const response = await axiosInstance({
        method,
        url: targetUrl,
        headers: {
          'X-Auth-Token': authData.token,
          'Content-Type': 'application/json',
          'OpenStack-API-Version': 'compute 2.8',
          ...proxyHeaders
        },
        data
      });

      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        invalidateAuthCache(cacheKey);
        lastError = error;
        if (attempt < maxRetries) {
          await sleep(150 * (attempt + 1));
          continue;
        }
      }

      if (status >= 500 || isTransientNetworkError(error)) {
        lastError = error;
        if (attempt < maxRetries) {
          const backoffMs = Math.min(2000, 300 * Math.pow(2, attempt));
          await sleep(backoffMs);
          continue;
        }
      }

      throw new Error(`OpenStack API request failed: ${error.message || String(error)}`);
    }
  }

  throw new Error(`OpenStack API request failed after retries: ${lastError?.message || 'Unknown error'}`);
}

/**
 * List all instances in a project using project-specific authentication
 */
async function listInstancesForProject(provider, projectName, projectId) {
  try {
    const instances = await makeRequestForProject(provider, projectName, `/servers/detail?project_id=${projectId}`);
    return instances.servers || [];
  } catch (error) {
    console.error('Error listing instances for project:', error);
    return [];
  }
}

/**
 * Ingest VMs from OpenStack provider
 */
async function ingestVMsFromProvider(provider, teamId = null) {
  try {
    const { searchAll, insert, update } = require('../utils/db');
    const { v4: uuidv4 } = require('uuid');
    
    let ingestedCount = 0;
    const instances = [];
    
    console.log(`Starting VM ingestion for provider: ${provider.name}`);
    
    // Get all workshops for this provider
    const workshops = await searchAll('workshops', ['provider_id'], [provider.id]);
    console.log(`Found ${workshops.length} workshops for provider ${provider.name}`);
    
    for (const workshop of workshops) {
      try {
        console.log(`Processing workshop: ${workshop.name} (Project: ${workshop.openstack_project_name})`);
        
        // Use the workshop's project name to get the project ID
        const projectId = await getOpenStackProjectId(provider, workshop.openstack_project_name);
        if (!projectId) {
          console.log(`Project not found for workshop: ${workshop.name} (Project Name: ${workshop.openstack_project_name})`);
          continue;
        }
        
        console.log(`Found project ID: ${projectId} for workshop: ${workshop.name}`);
        
        // List instances in the specific project using project-specific authentication
        const openstackInstances = await listInstancesForProject(provider, workshop.openstack_project_name, projectId);
        console.log(`Found ${openstackInstances.length} instances in project ${workshop.openstack_project_name}`);
        
        for (const openstackInstance of openstackInstances) {
          try {
            console.log(`Processing instance: ${openstackInstance.name} (ID: ${openstackInstance.id})`);
            
            // Check if instance already exists in database
            const existingInstances = await searchAll('instances', ['openstack_id'], [openstackInstance.id]);
            
            if (existingInstances.length === 0) {
              // Create new instance record
              const instanceId = uuidv4();
              const instanceData = {
                id: instanceId,
                name: openstackInstance.name,
                openstack_id: openstackInstance.id,
                workshop_id: workshop.id,
                team_id: teamId,
                user_id: null,
                status: openstackInstance.status || 'UNKNOWN',
                power_state: openstackInstance.power_state || 'UNKNOWN',
                locked: false,
                created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
              };
              
              await insert('instances', Object.keys(instanceData), Object.values(instanceData));
              ingestedCount++;
              
              console.log(`Created new instance: ${openstackInstance.name} in workshop: ${workshop.name}`);
              
              instances.push({
                id: instanceId,
                name: openstackInstance.name,
                openstack_id: openstackInstance.id,
                workshop_id: workshop.id,
                status: openstackInstance.status,
                power_state: openstackInstance.power_state
              });
            } else {
              // Update existing instance with latest status
              const existingInstance = existingInstances[0];
              await update('instances', 'status', openstackInstance.status, 'id', [existingInstance.id]);
              await update('instances', 'power_state', openstackInstance.power_state, 'id', [existingInstance.id]);
              
              console.log(`Updated existing instance: ${openstackInstance.name} in workshop: ${workshop.name}`);
              
              instances.push({
                id: existingInstance.id,
                name: existingInstance.name,
                openstack_id: existingInstance.openstack_id,
                workshop_id: workshop.id,
                status: openstackInstance.status,
                power_state: openstackInstance.power_state
              });
            }
          } catch (instanceError) {
            console.error(`Error processing instance ${openstackInstance.id}:`, instanceError);
          }
        }
      } catch (workshopError) {
        console.error(`Error processing workshop ${workshop.name}:`, workshopError);
      }
    }
    
    console.log(`VM ingestion completed. Total ingested: ${ingestedCount}, Total processed: ${instances.length}`);
    
    return {
      ingested_count: ingestedCount,
      instances: instances
    };
  } catch (error) {
    console.error('Error ingesting VMs from provider:', error);
    throw new Error('Failed to ingest VMs from provider');
  }
}

/**
 * Ingest specific VMs from OpenStack provider
 */
async function ingestSpecificVMsFromProvider(provider, teamId = null, instanceIds = [], projectName = null) {
  try {
    const { searchAll, insert, update } = require('../utils/db');
    const { v4: uuidv4 } = require('uuid');
    
    let ingestedCount = 0;
    const instances = [];
    
    console.log(`Starting specific VM ingestion for provider: ${provider.name}`);
    console.log(`Instance IDs to ingest: ${instanceIds.join(', ')}`);
    
    // Get the workshop for this project
    let workshop = null;
    if (projectName) {
      const workshops = await searchAll('workshops', ['openstack_project_name'], [projectName]);
      if (workshops.length > 0) {
        workshop = workshops[0];
        console.log(`Found workshop: ${workshop.name} for project: ${projectName}`);
      }
    }
    
    if (!workshop) {
      throw new Error('No workshop found for the specified project');
    }
    
    // Get project ID
    const projectId = await getOpenStackProjectId(provider, projectName);
    if (!projectId) {
      throw new Error(`Project not found: ${projectName}`);
    }
    
    console.log(`Found project ID: ${projectId} for project: ${projectName}`);
    
    // List all instances in the project
    const openstackInstances = await listInstancesForProject(provider, projectName, projectId);
    console.log(`Found ${openstackInstances.length} instances in project ${projectName}`);
    
    // Filter instances to only include the requested ones
    const filteredInstances = openstackInstances.filter(instance => 
      instanceIds.includes(instance.id)
    );
    
    console.log(`Filtered to ${filteredInstances.length} requested instances`);
    
    for (const openstackInstance of filteredInstances) {
      try {
        console.log(`Processing instance: ${openstackInstance.name} (ID: ${openstackInstance.id})`);
        
        // Check if instance already exists in database
        const existingInstances = await searchAll('instances', ['openstack_id'], [openstackInstance.id]);
        
        if (existingInstances.length === 0) {
          // Create new instance record
          const instanceId = uuidv4();
          const instanceData = {
            id: instanceId,
            name: openstackInstance.name,
            openstack_id: openstackInstance.id,
            workshop_id: workshop.id,
            team_id: teamId,
            user_id: null,
            status: openstackInstance.status || 'UNKNOWN',
            power_state: openstackInstance.power_state || 'UNKNOWN',
            locked: false,
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };
          
          await insert('instances', Object.keys(instanceData), Object.values(instanceData));
          ingestedCount++;
          
          console.log(`Created new instance: ${openstackInstance.name} in workshop: ${workshop.name}`);
          
          instances.push({
            id: instanceId,
            name: openstackInstance.name,
            openstack_id: openstackInstance.id,
            workshop_id: workshop.id,
            status: openstackInstance.status,
            power_state: openstackInstance.power_state
          });
        } else {
          // Update existing instance with latest status and team assignment
          const existingInstance = existingInstances[0];
          await update('instances', 'status', openstackInstance.status, 'id', [existingInstance.id]);
          await update('instances', 'power_state', openstackInstance.power_state, 'id', [existingInstance.id]);
          
          if (teamId) {
            await update('instances', 'team_id', teamId, 'id', [existingInstance.id]);
          }
          
          console.log(`Updated existing instance: ${openstackInstance.name} in workshop: ${workshop.name}`);
          
          instances.push({
            id: existingInstance.id,
            name: existingInstance.name,
            openstack_id: existingInstance.openstack_id,
            workshop_id: workshop.id,
            status: openstackInstance.status,
            power_state: openstackInstance.power_state
          });
        }
      } catch (instanceError) {
        console.error(`Error processing instance ${openstackInstance.id}:`, instanceError);
      }
    }
    
    console.log(`Specific VM ingestion completed. Total ingested: ${ingestedCount}, Total processed: ${instances.length}`);
    
    return {
      ingested_count: ingestedCount,
      instances: instances
    };
  } catch (error) {
    console.error('Error ingesting specific VMs from provider:', error);
    throw new Error('Failed to ingest specific VMs from provider');
  }
}

/**
 * Update instance statuses (scheduled task)
 */
async function updateInstanceStatuses() {
  try {
    const { searchAll, update } = require('../utils/db');
    
    // Get all providers
    const providers = await searchAll('providers', [], [], { orderBy: 'name' });
    
    for (const provider of providers) {
      if (!provider.enabled) continue;
      
      try {
        // Get all workshops for this provider
        const workshops = await searchAll('workshops', ['provider_id'], [provider.id]);
        
        for (const workshop of workshops) {
          try {
            // Get project ID
            const projectId = await getOpenStackProjectId(provider, workshop.openstack_project_name);
            if (!projectId) continue;
            
            // List instances in project using project-scoped authentication to ensure visibility
            const instances = await listInstancesForProject(
              provider,
              workshop.openstack_project_name,
              projectId
            );
            
            // Update database with instance statuses and IP addresses
            for (const openstackInstance of instances) {
              const dbInstance = await searchAll('instances', ['openstack_id'], [openstackInstance.id]);
              
              if (dbInstance.length > 0) {
                const instance = dbInstance[0];
                await update('instances', 'status', openstackInstance.status, 'id', [instance.id]);
                await update('instances', 'power_state', openstackInstance.power_state, 'id', [instance.id]);
                
                // Extract and update IP addresses (both fixed and floating)
                const ipAddresses = [];
                if (openstackInstance.addresses) {
                  for (const networkName in openstackInstance.addresses) {
                    const networkAddresses = openstackInstance.addresses[networkName];
                    if (Array.isArray(networkAddresses)) {
                      for (const addr of networkAddresses) {
                        if (addr && addr.addr) {
                          ipAddresses.push(addr.addr);
                        }
                      }
                    }
                  }
                }
                
                // Persist even if empty to clear stale IPs
                await update('instances', 'ip_addresses', JSON.stringify(ipAddresses), 'id', [instance.id]);
              }
            }
          } catch (workshopError) {
            console.error(`Error updating workshop ${workshop.name}:`, workshopError);
          }
        }
      } catch (providerError) {
        console.error(`Error updating provider ${provider.name}:`, providerError);
      }
    }
    
    console.log('Instance status update completed');
  } catch (error) {
    console.error('Error updating instance statuses:', error);
  }
}

module.exports = {
  testOpenStackConnection,
  getOpenStackProjectId,
  listInstances,
  getInstanceDetails,
  getInstanceStatus,
  powerOnInstance,
  powerOffInstance,
  restartInstance,
  getConsoleUrl,
  getConsoleUrlForProject,
  ingestVMsFromProvider,
  ingestSpecificVMsFromProvider,
  updateInstanceStatuses,
  getAuthTokenForProject,
  makeRequestForProject,
  listInstancesForProject
}; 