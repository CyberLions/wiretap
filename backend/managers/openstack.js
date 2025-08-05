const axios = require('axios');
const { openstackConfig } = require('../utils/config');
const { update } = require('../utils/db');

// OpenStack authentication cache
const authCache = new Map();

/**
 * Get OpenStack authentication token and service catalog
 */
async function getAuthToken(provider) {
  const cacheKey = `${provider.id}_${provider.auth_url}`;
  
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
    
    console.log('authData', authData);
    console.log('authUrl', authUrl);
    
    const response = await axios.post(
      `${authUrl}/auth/tokens`,
      authData,
      {
        headers: {
          'Content-Type': 'application/json'
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
  const authData = await getAuthToken(provider);
  
  try {
    // Find compute service endpoint from service catalog
    const computeService = authData.serviceCatalog.find(service => service.type === 'compute');
    if (!computeService) {
      throw new Error('Compute service not found in service catalog');
    }
    
    const region = provider.region_name || openstackConfig.defaultRegion;
    const computeEndpoint = computeService.endpoints.find(endpoint => 
      endpoint.interface === 'public' && endpoint.region === region
    );
    
    if (!computeEndpoint) {
      throw new Error(`Compute endpoint not found for region: ${region}`);
    }
    
    const response = await axios({
      method,
      url: `${computeEndpoint.url}${endpoint}`,
      headers: {
        'X-Auth-Token': authData.token,
        'Content-Type': 'application/json',
        'OpenStack-API-Version': 'compute 2.8'
      },
      data,
      timeout: openstackConfig.connectionTimeout
    });
    
    return response.data;
  } catch (error) {
    console.error('OpenStack API error:', error.message);
    throw new Error(`OpenStack API request failed: ${error.message}`);
  }
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
    const response = await axios.get(
      `${authUrl}/projects`,
      {
        headers: {
          'X-Auth-Token': authData.token,
          'Content-Type': 'application/json'
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
    const identityVersion = provider.identity_version || 'v3';
    const authUrl = provider.auth_url.endsWith('/') 
      ? `${provider.auth_url}${identityVersion}`
      : `${provider.auth_url}/${identityVersion}`;
    
    const authData = await getAuthToken(provider);
    const response = await axios.get(
      `${authUrl}/projects`,
      {
        headers: {
          'X-Auth-Token': authData.token,
          'Content-Type': 'application/json'
        },
        timeout: openstackConfig.connectionTimeout
      }
    );
    
    const project = response.data.projects.find(p => p.name === projectName);
    return project ? project.id : null;
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
    const instance = await makeRequest(provider, `/servers/${instanceId}`);
    return instance.server;
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
    await update('instances', 'status', details.status, 'id', instance.id);
    await update('instances', 'power_state', details.power_state, 'id', instance.id);
    
    return {
      status: details.status,
      power_state: details.power_state,
      flavor: details.flavor?.name,
      image: details.image?.name,
      ip_addresses: details.addresses
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
    await update('instances', 'power_state', 'RUNNING', 'id', instance.id);
    
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
    await update('instances', 'power_state', 'SHUTDOWN', 'id', instance.id);
    
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
  const cacheKey = `${provider.id}_${provider.auth_url}_${projectName}`;
  
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
    
    const response = await axios.post(
      `${authUrl}/auth/tokens`,
      authData,
      {
        headers: {
          'Content-Type': 'application/json'
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
  const authData = await getAuthTokenForProject(provider, projectName);
  
  try {
    // Find compute service endpoint from service catalog
    const computeService = authData.serviceCatalog.find(service => service.type === 'compute');
    if (!computeService) {
      throw new Error('Compute service not found in service catalog');
    }
    
    const region = provider.region_name || openstackConfig.defaultRegion;
    const computeEndpoint = computeService.endpoints.find(endpoint => 
      endpoint.interface === 'public' && endpoint.region === region
    );
    
    if (!computeEndpoint) {
      throw new Error(`Compute endpoint not found for region: ${region}`);
    }
    
    const response = await axios({
      method,
      url: `${computeEndpoint.url}${endpoint}`,
      headers: {
        'X-Auth-Token': authData.token,
        'Content-Type': 'application/json',
        'OpenStack-API-Version': 'compute 2.8'
      },
      data,
      timeout: openstackConfig.connectionTimeout
    });
    
    return response.data;
  } catch (error) {
    console.error('OpenStack API error:', error.message);
    throw new Error(`OpenStack API request failed: ${error.message}`);
  }
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
              await update('instances', 'status', openstackInstance.status, 'id', existingInstance.id);
              await update('instances', 'power_state', openstackInstance.power_state, 'id', existingInstance.id);
              
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
 * Update instance statuses (scheduled task)
 */
async function updateInstanceStatuses() {
  try {
    const { searchAll } = require('../utils/db');
    
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
            
            // List instances in project
            const instances = await listInstances(provider, projectId);
            
            // Update database with instance statuses
            for (const openstackInstance of instances) {
              const dbInstance = await searchAll('instances', ['openstack_id'], [openstackInstance.id]);
              
              if (dbInstance.length > 0) {
                const instance = dbInstance[0];
                await update('instances', 'status', openstackInstance.status, 'id', instance.id);
                await update('instances', 'power_state', openstackInstance.power_state, 'id', instance.id);
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
  updateInstanceStatuses,
  getAuthTokenForProject,
  makeRequestForProject,
  listInstancesForProject
}; 