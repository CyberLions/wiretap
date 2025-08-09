const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { testOpenStackConnection } = require('./openstack');

/**
 * Get all providers
 */
async function getAllProviders() {
  const providers = await searchAll('providers', [], [], { orderBy: 'name' });
  
  // Remove sensitive information
  return providers.map(provider => {
    const { password, ...sanitized } = provider;
    return sanitized;
  });
}

/**
 * Get provider by ID
 */
async function getProviderById(id) {
  const provider = await search('providers', 'id', id);
  
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  // Remove sensitive information
  const { password, ...sanitized } = provider;
  return sanitized;
}

/**
 * Create new provider
 */
async function createProvider(providerData) {
  const { 
    name, 
    description, 
    auth_url, 
    username, 
    password, 
    project_name, 
    domain_name, 
    region_name, 
    identity_version = 'v3',
    enabled = true 
  } = providerData;
  
  if (!name || !auth_url || !username || !password || !project_name) {
    throw new Error('Name, auth_url, username, password, and project_name are required');
  }
  
  // Check if provider name already exists
  const existingProvider = await search('providers', 'name', name);
  if (existingProvider) {
    throw new Error('Provider name already exists');
  }
  
  const providerId = uuidv4();
  const newProvider = {
    id: providerId,
    name,
    description: description || null,
    auth_url,
    username,
    password,
    project_name,
    domain_name: domain_name || 'Default',
    region_name: region_name || null,
    identity_version,
    enabled,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };
  
  await insert('providers', Object.keys(newProvider), Object.values(newProvider));
  
  // Return sanitized provider
  const { password: pwd, ...sanitized } = newProvider;
  return sanitized;
}

/**
 * Update provider
 */
async function updateProvider(id, updateData) {
  const provider = await search('providers', 'id', id);
  
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  const updateFields = [
    'name', 'description', 'auth_url', 'username', 'password', 
    'project_name', 'domain_name', 'region_name', 'identity_version', 'enabled'
  ];
  
  for (const field of updateFields) {
    if (updateData[field] !== undefined) {
              await update('providers', field, updateData[field], 'id', [id]);
    }
  }
  
  // Return updated provider
  const updatedProvider = await search('providers', 'id', id);
  const { password, ...sanitized } = updatedProvider;
  return sanitized;
}

/**
 * Delete provider
 */
async function deleteProvider(id) {
  const provider = await search('providers', 'id', id);
  
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  await deleteFrom('providers', ['id'], [id]);
  
  return { message: 'Provider deleted successfully' };
}

/**
 * Test provider connection
 */
async function testProviderConnection(id) {
  const provider = await search('providers', 'id', id);
  
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  try {
    const result = await testOpenStackConnection(provider);
    return result;
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Enable/disable provider
 */
async function toggleProviderStatus(id, enabled) {
  const provider = await search('providers', 'id', id);
  
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  await update('providers', 'enabled', enabled, 'id', [id]);
  
  return { message: `Provider ${enabled ? 'enabled' : 'disabled'} successfully` };
}

/**
 * Get provider with workshops
 */
async function getProviderWithWorkshops(id) {
  const provider = await search('providers', 'id', id);
  
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  const workshops = await searchAll('workshops', ['provider_id'], [id]);
  
  // Remove sensitive information
  const { password, ...sanitizedProvider } = provider;
  
  return {
    ...sanitizedProvider,
    workshops
  };
}

/**
 * Get provider statistics
 */
async function getProviderStats() {
  const stats = await searchAll('providers', [], [], { orderBy: 'name' });
  
  const enabledCount = stats.filter(p => p.enabled).length;
  const disabledCount = stats.filter(p => !p.enabled).length;
  
  return {
    total_providers: stats.length,
    enabled_providers: enabledCount,
    disabled_providers: disabledCount
  };
}

module.exports = {
  getAllProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  testProviderConnection,
  toggleProviderStatus,
  getProviderWithWorkshops,
  getProviderStats
};
