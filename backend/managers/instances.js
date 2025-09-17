const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');
const { v4: uuidv4 } = require('uuid');
const { getInstanceDetails } = require('./openstack');

/**
 * Get all instances with optional filtering
 */
async function getAllInstances(user, filters = {}) {
  const { workshop, status, power_state, team, competition } = filters;
  let instances;
  let whereConditions = [];
  let params = [];
  
  // If user is admin or service account, show all instances
  if (user.role === 'ADMIN' || user.role === 'SERVICE_ACCOUNT') {
    let baseQuery = `
      SELECT i.*, 
             w.name as workshop_name,
             t.name as team_name,
             CASE 
               WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL 
               THEN CONCAT(u.first_name, ' ', u.last_name)
               WHEN u.first_name IS NOT NULL 
               THEN u.first_name
               WHEN u.last_name IS NOT NULL 
               THEN u.last_name
               ELSE u.username
             END as user_name
      FROM instances i
      LEFT JOIN workshops w ON i.workshop_id = w.id
      LEFT JOIN teams t ON i.team_id = t.id
      LEFT JOIN users u ON i.user_id = u.id
    `;
    
    // Add filters
    if (workshop) {
      whereConditions.push('i.workshop_id = ?');
      params.push(workshop);
    }
    if (status) {
      whereConditions.push('i.status = ?');
      params.push(status);
    }
    if (power_state) {
      whereConditions.push('i.power_state = ?');
      params.push(power_state);
    }
    if (team) {
      whereConditions.push('i.team_id = ?');
      params.push(team);
    }
    if (competition) {
      whereConditions.push('w.id = ?');
      params.push(competition);
    }
    
    if (whereConditions.length > 0) {
      baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    baseQuery += ' ORDER BY i.name';
    instances = await executeQuery(baseQuery, params);
  } else {
    // Get instances that user has access to
    const userTeams = await searchAll('user_teams', ['user_id'], [user.id]);
    const teamIds = userTeams.map(ut => ut.team_id);
    
    // Get instances assigned to user or user's teams
    const userInstances = await searchAll('instances', ['user_id'], [user.id]);
    const teamInstances = teamIds.length > 0 ? 
      await executeQuery(
        `SELECT * FROM instances WHERE team_id IN (${teamIds.map(() => '?').join(',')})`,
        teamIds
      ) : [];
    
    // Combine and deduplicate
    const allInstances = [...userInstances, ...teamInstances];
    const instanceIds = [...new Set(allInstances.map(instance => instance.id))];
    
    if (instanceIds.length === 0) {
      instances = [];
    } else {
      let baseQuery = `
        SELECT i.*, 
               w.name as workshop_name,
               t.name as team_name,
               CASE 
                 WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL 
                 THEN CONCAT(u.first_name, ' ', u.last_name)
                 WHEN u.first_name IS NOT NULL 
                 THEN u.first_name
                 WHEN u.last_name IS NOT NULL 
                 THEN u.last_name
                 ELSE u.username
               END as user_name
        FROM instances i
        LEFT JOIN workshops w ON i.workshop_id = w.id
        LEFT JOIN teams t ON i.team_id = t.id
        LEFT JOIN users u ON i.user_id = u.id
        WHERE i.id IN (${instanceIds.map(() => '?').join(',')})
      `;
      
      params = [...instanceIds];
      
      // Add additional filters
      if (workshop) {
        whereConditions.push('i.workshop_id = ?');
        params.push(workshop);
      }
      if (status) {
        whereConditions.push('i.status = ?');
        params.push(status);
      }
      if (power_state) {
        whereConditions.push('i.power_state = ?');
        params.push(power_state);
      }
      if (team) {
        whereConditions.push('i.team_id = ?');
        params.push(team);
      }
      if (competition) {
        whereConditions.push('w.id = ?');
        params.push(competition);
      }
      
      if (whereConditions.length > 0) {
        baseQuery += ' AND ' + whereConditions.join(' AND ');
      }
      
      baseQuery += ' ORDER BY i.name';
      instances = await executeQuery(baseQuery, params);
    }
  }
  
  return instances;
}

/**
 * Get instance by ID
 */
async function getInstanceById(id) {
  const instances = await executeQuery(`
    SELECT i.*, 
           w.name as workshop_name,
           t.name as team_name,
           CASE 
             WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL 
             THEN CONCAT(u.first_name, ' ', u.last_name)
             WHEN u.first_name IS NOT NULL 
             THEN u.first_name
             WHEN u.last_name IS NOT NULL 
             THEN u.last_name
             ELSE u.username
           END as user_name
    FROM instances i
    LEFT JOIN workshops w ON i.workshop_id = w.id
    LEFT JOIN teams t ON i.team_id = t.id
    LEFT JOIN users u ON i.user_id = u.id
    WHERE i.id = ?
  `, [id]);
  
  return instances[0] || null;
}

/**
 * Create new instance
 */
async function createInstance(instanceData) {
  const { name, workshop_id, openstack_id, team_id, user_id } = instanceData;
  
  if (!name || !workshop_id || !openstack_id) {
    throw new Error('Name, workshop_id, and openstack_id are required');
  }
  
  // Verify workshop exists
  const workshop = await search('workshops', 'id', workshop_id);
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  // Check if OpenStack ID already exists
  const existingInstance = await search('instances', 'openstack_id', openstack_id);
  if (existingInstance) {
    throw new Error('Instance with this OpenStack ID already exists');
  }
  
  const instanceId = uuidv4();
  const newInstanceData = {
    id: instanceId,
    name,
    openstack_id,
    workshop_id,
    team_id: team_id || null,
    user_id: user_id || null,
    status: 'UNKNOWN',
    power_state: 'UNKNOWN',
    locked: false
  };
  
  await insert('instances', Object.keys(newInstanceData), Object.values(newInstanceData));
  
  // Sync the new instance immediately to get its current status
  try {
    const provider = await search('providers', 'id', workshop.provider_id);
    const openstackInstance = await getInstanceDetails(provider, openstack_id);
    
    if (openstackInstance) {
              await update('instances', 'status', openstackInstance.status, 'id', [instanceId]);
        await update('instances', 'power_state', openstackInstance.power_state, 'id', [instanceId]);
      
      // Extract IP addresses
      const ipAddresses = extractIpAddresses(openstackInstance);
      if (ipAddresses.length > 0) {
        await update('instances', 'ip_addresses', JSON.stringify(ipAddresses), 'id', [instanceId]);
      }
    }
  } catch (syncError) {
    console.error('Error syncing new instance:', syncError);
    // Don't fail the creation if sync fails
  }
  
  return await search('instances', 'id', instanceId);
}

/**
 * Update instance
 */
async function updateInstance(id, updateData) {
  const instance = await search('instances', 'id', id);
  if (!instance) {
    throw new Error('Instance not found');
  }
  
  const updateFields = ['name', 'team_id', 'user_id', 'locked'];
  
  for (const field of updateFields) {
    if (updateData[field] !== undefined) {
              await update('instances', field, updateData[field], 'id', [id]);
    }
  }
  
  return await search('instances', 'id', id);
}

/**
 * Delete instance
 */
async function deleteInstance(id) {
  const instance = await search('instances', 'id', id);
  if (!instance) {
    throw new Error('Instance not found');
  }
  
  await deleteFrom('instances', ['id'], [id]);
  return { message: 'Instance deleted successfully' };
}

/**
 * Extract IP addresses from OpenStack instance data
 */
function extractIpAddresses(openstackInstance) {
  const ipAddresses = [];
  if (openstackInstance.addresses) {
    for (const networkName in openstackInstance.addresses) {
      const networkAddresses = openstackInstance.addresses[networkName];
      if (Array.isArray(networkAddresses)) {
        for (const addr of networkAddresses) {
          //if (addr.addr && addr['OS-EXT-IPS:type'] === 'fixed') {
            ipAddresses.push(addr.addr);
          //}
        }
      }
    }
  }
  return ipAddresses;
}

/**
 * Sync single instance with OpenStack
 */
async function syncInstance(id) {
  const instance = await search('instances', 'id', id);
  if (!instance) {
    throw new Error('Instance not found');
  }
  
  // Get workshop and provider info
  const workshop = await search('workshops', 'id', instance.workshop_id);
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  const provider = await search('providers', 'id', workshop.provider_id);
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  // Get instance details from OpenStack
  const openstackInstance = await getInstanceDetails(provider, instance.openstack_id);
  
  if (openstackInstance) {
    // Update instance with OpenStack data
    await update('instances', 'status', openstackInstance.status, 'id', [instance.id]);
    await update('instances', 'power_state', openstackInstance.power_state, 'id', [instance.id]);
    
    // Extract IP addresses from addresses field
    const ipAddresses = extractIpAddresses(openstackInstance);
    
    if (ipAddresses.length > 0) {
      await update('instances', 'ip_addresses', JSON.stringify(ipAddresses), 'id', [instance.id]);
    }
    
    // Get updated instance data
    const updatedInstance = await search('instances', 'id', instance.id);
    
    return {
      message: 'Instance synced successfully',
      instance: updatedInstance,
      openstack_data: {
        status: openstackInstance.status,
        power_state: openstackInstance.power_state,
        ip_addresses: ipAddresses
      }
    };
  } else {
    throw new Error('Instance not found in OpenStack');
  }
}

/**
 * Sync all instances with OpenStack
 */
async function syncAllInstances() {
  const instances = await searchAll('instances', [], []);
  let syncedCount = 0;
  let errorCount = 0;
  
  for (const instance of instances) {
    try {
      console.log('Syncing instance:', instance.id);

      // Get workshop and provider info
      const workshop = await search('workshops', 'id', instance.workshop_id);
      if (!workshop) {
        console.log(`Workshop not found for instance ${instance.id}`);
        continue;
      }
      
      const provider = await search('providers', 'id', workshop.provider_id);
      if (!provider) {
        console.log(`Provider not found for instance ${instance.id}`);
        continue;
      }
      
      // Get instance details from OpenStack
      const openstackInstance = await getInstanceDetails(provider, instance.openstack_id);
      
      if (openstackInstance) {
        // Update instance with OpenStack data
        await update('instances', 'status', openstackInstance.status, 'id', [instance.id]);
        await update('instances', 'power_state', openstackInstance.power_state, 'id', [instance.id]);
        
        // Update IP addresses - extract from addresses field
        const ipAddresses = extractIpAddresses(openstackInstance);
        
        if (ipAddresses.length > 0) {
          await update('instances', 'ip_addresses', JSON.stringify(ipAddresses), 'id', [instance.id]);
          console.log(`Updated IP addresses for instance ${instance.id}:`, ipAddresses);
        }
        
        syncedCount++;
      } else {
        console.log(`No OpenStack data found for instance ${instance.id}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`Error syncing instance ${instance.id}:`, error);
      errorCount++;
    }
  }
  
  return {
    message: 'Instances synced successfully',
    synced_count: syncedCount,
    error_count: errorCount,
    total_instances: instances.length
  };
}

/**
 * Check if user can access instance
 */
async function canUserAccessInstance(userId, instanceId) {
  const instance = await search('instances', 'id', instanceId);
  if (!instance) {
    return false;
  }
  
  // User can access if they own the instance
  if (instance.user_id === userId) {
    return true;
  }
  
  // User can access if they're on the team that owns the instance
  if (instance.team_id) {
    const userTeam = await searchAll('user_teams', ['user_id', 'team_id'], [userId, instance.team_id]);
    if (userTeam && userTeam.length > 0) {
      return true;
    }
  }
  
  return false;
}

module.exports = {
  getAllInstances,
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  syncInstance,
  syncAllInstances,
  canUserAccessInstance,
  extractIpAddresses
};
