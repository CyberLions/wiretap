const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');

/**
 * Get all workshops for a user
 */
async function getAllWorkshops(user) {
  let workshops;
  
  // If user is admin, show all workshops
  if (user.role === 'ADMIN') {
    workshops = await searchAll('workshops', [], [], { orderBy: 'name' });
  } else {
    // Get workshops that user has access to
    const userTeams = await searchAll('user_teams', ['user_id'], [user.id]);
    const teamIds = userTeams.map(ut => ut.team_id);
    
    if (teamIds.length === 0) {
      workshops = [];
    } else {
      const teams = await searchAll('teams', ['id'], teamIds);
      const workshopIds = [...new Set(teams.map(team => team.workshop_id))];
      
      if (workshopIds.length === 0) {
        workshops = [];
      } else {
        workshops = await searchAll('workshops', ['id'], workshopIds, { orderBy: 'name' });
      }
    }
  }
  
  return workshops;
}

/**
 * Get workshop by ID
 */
async function getWorkshopById(id) {
  const workshop = await search('workshops', 'id', id);
  
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  return workshop;
}

/**
 * Create new workshop
 */
async function createWorkshop(workshopData) {
  const { 
    name, 
    description, 
    provider_id, 
    openstack_project_name, 
    enabled = true,
    lockout_start = null,
    lockout_end = null
  } = workshopData;
  
  if (!name || !provider_id || !openstack_project_name) {
    throw new Error('Name, provider_id, and openstack_project_name are required');
  }
  
  // Check if provider exists
  const provider = await search('providers', 'id', provider_id);
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  // Check if workshop name already exists
  const existingWorkshop = await search('workshops', 'name', name);
  if (existingWorkshop) {
    throw new Error('Workshop name already exists');
  }
  
  // Check if OpenStack project name already exists for this provider
  const existingProject = await search('workshops', ['provider_id', 'openstack_project_name'], [provider_id, openstack_project_name]);
  if (existingProject) {
    throw new Error('OpenStack project name already exists for this provider');
  }
  
  const workshopId = uuidv4();
  const newWorkshop = {
    id: workshopId,
    name,
    description: description || null,
    provider_id,
    openstack_project_name,
    enabled,
    lockout_start: lockout_start ? new Date(lockout_start).toISOString().slice(0, 19).replace('T', ' ') : null,
    lockout_end: lockout_end ? new Date(lockout_end).toISOString().slice(0, 19).replace('T', ' ') : null,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };
  
  await insert('workshops', Object.keys(newWorkshop), Object.values(newWorkshop));
  
  return await search('workshops', 'id', workshopId);
}

/**
 * Update workshop
 */
async function updateWorkshop(id, updateData) {
  const workshop = await search('workshops', 'id', id);
  
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  const updateFields = ['name', 'description', 'provider_id', 'openstack_project_name', 'enabled', 'lockout_start', 'lockout_end'];
  
  for (const field of updateFields) {
    if (updateData[field] !== undefined) {
      let value = updateData[field];
      if ((field === 'lockout_start' || field === 'lockout_end')) {
        if (value === '') {
          value = null;
        } else if (value != null) {
          const d = new Date(value);
          if (!isNaN(d)) {
            value = d.toISOString().slice(0, 19).replace('T', ' ');
          } else {
            continue; // skip invalid date
          }
        }
      }
              await update('workshops', field, value, 'id', [id]);
    }
  }
  
  return await search('workshops', 'id', id);
}

/**
 * Delete workshop
 */
async function deleteWorkshop(id) {
  const workshop = await search('workshops', 'id', id);
  
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  await deleteFrom('workshops', ['id'], [id]);
  
  return { message: 'Workshop deleted successfully' };
}

/**
 * Get workshop with provider information
 */
async function getWorkshopWithProvider(id) {
  const workshop = await search('workshops', 'id', id);
  
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  const provider = await search('providers', 'id', workshop.provider_id);
  
  return {
    ...workshop,
    provider: provider ? { id: provider.id, name: provider.name } : null
  };
}

/**
 * Get workshop with teams
 */
async function getWorkshopWithTeams(id) {
  const workshop = await search('workshops', 'id', id);
  
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  const teams = await searchAll('teams', ['workshop_id'], [id]);
  
  return {
    ...workshop,
    teams
  };
}

/**
 * Get workshop with instances
 */
async function getWorkshopWithInstances(id) {
  const workshop = await search('workshops', 'id', id);
  
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  const instances = await searchAll('instances', ['workshop_id'], [id]);
  
  return {
    ...workshop,
    instances
  };
}

/**
 * Get workshops with provider information
 */
async function getWorkshopsWithProviders() {
  const workshops = await executeQuery(`
    SELECT w.*, p.name as provider_name
    FROM workshops w
    LEFT JOIN providers p ON w.provider_id = p.id
    ORDER BY w.name
  `);
  
  return workshops;
}

/**
 * Get workshop statistics
 */
async function getWorkshopStats() {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_workshops,
      SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_workshops,
      SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled_workshops
    FROM workshops
  `);
  
  return stats[0];
}

/**
 * Check if user can access workshop
 */
async function canUserAccessWorkshop(userId, workshopId) {
  // Admin can access all workshops
  const user = await search('users', 'id', userId);
  if (user && user.role === 'ADMIN') {
    return true;
  }
  
  // Check if user is in a team that belongs to this workshop
  const userTeams = await searchAll('user_teams', ['user_id'], [userId]);
  const teamIds = userTeams.map(ut => ut.team_id);
  
  if (teamIds.length === 0) {
    return false;
  }
  
  const teams = await searchAll('teams', ['id'], teamIds);
  const userWorkshopIds = [...new Set(teams.map(team => team.workshop_id))];
  
  return userWorkshopIds.includes(workshopId);
}

/**
 * Enable/disable workshop
 */
async function toggleWorkshopStatus(id, enabled) {
  const workshop = await search('workshops', 'id', id);
  
  if (!workshop) {
    throw new Error('Workshop not found');
  }
  
  await update('workshops', 'enabled', enabled, 'id', [id]);
  
  return { message: `Workshop ${enabled ? 'enabled' : 'disabled'} successfully` };
}

module.exports = {
  getAllWorkshops,
  getWorkshopById,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  getWorkshopWithProvider,
  getWorkshopWithTeams,
  getWorkshopWithInstances,
  getWorkshopsWithProviders,
  getWorkshopStats,
  canUserAccessWorkshop,
  toggleWorkshopStatus
};
