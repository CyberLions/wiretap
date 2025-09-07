const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');

/**
 * Get all teams for a user
 */
async function getAllTeams(user) {
  let teams;
  
  // If user is admin or service account, show all teams
  if (user.role === 'ADMIN' || user.role === 'SERVICE_ACCOUNT') {
    teams = await searchAll('teams', [], [], { orderBy: 'team_number' });
  } else {
    // Get teams that user belongs to
    const userTeams = await searchAll('user_teams', ['user_id'], [user.id]);
    const teamIds = userTeams.map(ut => ut.team_id);
    
    if (teamIds.length === 0) {
      teams = [];
    } else {
      teams = await searchAll('teams', ['id'], teamIds, { orderBy: 'team_number' });
    }
  }
  
  return teams;
}

/**
 * Get team by ID
 */
async function getTeamById(id) {
  const team = await search('teams', 'id', id);
  
  if (!team) {
    throw new Error('Team not found');
  }
  
  return team;
}

/**
 * Create new team
 */
async function createTeam(teamData) {
  const { name, team_number, description, color } = teamData;
  
  if (!name || !team_number) {
    throw new Error('Name and team number are required');
  }
  
  // Check if team number already exists
  const existingTeam = await search('teams', 'team_number', team_number);
  if (existingTeam) {
    throw new Error('Team number already exists');
  }
  
  // Check if team name already exists
  const existingName = await search('teams', 'name', name);
  if (existingName) {
    throw new Error('Team name already exists');
  }
  
  const teamId = uuidv4();
  const newTeam = {
    id: teamId,
    name,
    team_number,
    description: description || null,
    color: color || null,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };
  
  await insert('teams', Object.keys(newTeam), Object.values(newTeam));
  
  return await search('teams', 'id', teamId);
}

/**
 * Update team
 */
async function updateTeam(id, updateData) {
  const team = await search('teams', 'id', id);
  
  if (!team) {
    throw new Error('Team not found');
  }
  
  const updateFields = ['name', 'team_number', 'description', 'color'];
  
  for (const field of updateFields) {
    if (updateData[field] !== undefined) {
              await update('teams', field, updateData[field], 'id', [id]);
    }
  }
  
  return await search('teams', 'id', id);
}

/**
 * Delete team
 */
async function deleteTeam(id) {
  const team = await search('teams', 'id', id);
  
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Check if team has instances and delete them
  const instances = await searchAll('instances', ['team_id'], [id]);
  if (instances.length > 0) {
    console.log(`Found ${instances.length} instances associated with team ${id}, deleting them...`);
    // Delete all instances associated with this team
    for (const instance of instances) {
      await deleteFrom('instances', ['id'], [instance.id]);
      console.log(`Deleted instance: ${instance.name} (ID: ${instance.id})`);
    }
    console.log(`Successfully deleted ${instances.length} instances associated with team ${id}`);
  }
  
  // Get all users in this team
  const userTeams = await searchAll('user_teams', ['team_id'], [id]);
  const userIds = userTeams.map(ut => ut.user_id);
  
  // Find users with @workshop.local emails to delete
  const usersToDelete = [];
  if (userIds.length > 0) {
    for (const userId of userIds) {
      const user = await search('users', 'id', userId);
      if (user && user.email && user.email.endsWith('@workshop.local')) {
        usersToDelete.push(userId);
      }
    }
  }
  
  // Delete users with @workshop.local emails
  for (const userId of usersToDelete) {
    await deleteFrom('users', ['id'], [userId]);
  }
  
  // Remove all remaining user associations
  await deleteFrom('user_teams', ['team_id'], [id]);
  
  // Delete team
  await deleteFrom('teams', ['id'], [id]);
  
  let message = 'Team deleted successfully.';
  
  if (instances.length > 0) {
    message += ` ${instances.length} associated instance(s) were also deleted.`;
  }
  
  if (usersToDelete.length > 0) {
    message += ` ${usersToDelete.length} generated user(s) with @workshop.local emails were also deleted.`;
  }
  
  return { message };
}

/**
 * Get team members
 */
async function getTeamMembers(teamId) {
  const members = await executeQuery(`
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.enabled
    FROM users u
    JOIN user_teams ut ON u.id = ut.user_id
    WHERE ut.team_id = ?
    ORDER BY u.username
  `, [teamId]);
  
  return members;
}

/**
 * Add member to team
 */
async function addMemberToTeam(teamId, userId) {
  // Check if team exists
  const team = await search('teams', 'id', teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Check if user exists
  const user = await search('users', 'id', userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Check if user is already in team
  const existingMembership = await searchAll('user_teams', ['user_id', 'team_id'], [userId, teamId]);
  if (existingMembership && existingMembership.length > 0) {
    throw new Error('User is already a member of this team');
  }
  
  const userTeamId = uuidv4();
  await insert('user_teams', ['id', 'user_id', 'team_id'], [userTeamId, userId, teamId]);
  
  return { message: 'Member added to team successfully' };
}

/**
 * Add user to team by email
 */
async function addUserToTeamByEmail(teamId, email) {
  // Check if team exists
  const team = await search('teams', 'id', teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  if (!email || typeof email !== 'string') {
    throw new Error('Valid email is required');
  }
  
  // Check if user exists by email
  const user = await search('users', 'email', email);
  
  if (user) {
    // User exists, add them to the team
    const existingMembership = await searchAll('user_teams', ['user_id', 'team_id'], [user.id, teamId]);
    if (existingMembership && existingMembership.length > 0) {
      throw new Error('User is already a member of this team');
    }
    
    const userTeamId = uuidv4();
    await insert('user_teams', ['id', 'user_id', 'team_id'], [userTeamId, user.id, teamId]);
    return { 
      message: 'User added to team successfully',
      user_id: user.id,
      status: 'existing_user'
    };
  } else {
    // User doesn't exist, store in temp_user_team table
    const existingTemp = await searchAll('temp_user_team', ['email', 'team_id'], [email, teamId]);
    if (existingTemp && existingTemp.length > 0) {
      throw new Error('User is already queued to join this team');
    }
    
    const tempId = uuidv4();
    await insert('temp_user_team', ['id', 'email', 'team_id'], [tempId, email, teamId]);
    
    return { 
      message: 'User will be added to team when they create an account',
      email,
      status: 'pending_user'
    };
  }
}

/**
 * Get pending team assignments for a user by email
 */
async function getPendingTeamAssignments(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Valid email is required');
  }
  
  const pendingAssignments = await searchAll('temp_user_team', ['email'], [email]);
  return pendingAssignments;
}

/**
 * Get all pending team assignments across all users
 */
async function getAllPendingTeamAssignments() {
  const pendingAssignments = await searchAll('temp_user_team', [], []);
  return pendingAssignments;
}

/**
 * Process pending team assignments for a user
 */
async function processPendingTeamAssignments(userId, email) {
  if (!userId || !email) {
    throw new Error('User ID and email are required');
  }
  
  const pendingAssignments = await getPendingTeamAssignments(email);
  
  if (pendingAssignments.length === 0) {
    return { message: 'No pending team assignments found' };
  }
  
  const results = [];
  
  for (const assignment of pendingAssignments) {
    try {
      // Check if user is already in this team
      const existingMembership = await searchAll('user_teams', ['user_id', 'team_id'], [userId, assignment.team_id]);
      
      if (!existingMembership || existingMembership.length === 0) {
        // Add user to team
        const userTeamId = uuidv4();
        await insert('user_teams', ['id', 'user_id', 'team_id'], [userTeamId, userId, assignment.team_id]);
        results.push({
          team_id: assignment.team_id,
          status: 'added'
        });
      } else {
        results.push({
          team_id: assignment.team_id,
          status: 'already_member'
        });
      }
      
      // Remove from temp table
      await deleteFrom('temp_user_team', ['id'], [assignment.id]);
      
    } catch (error) {
      console.error(`Error processing team assignment for team ${assignment.team_id}:`, error);
      results.push({
        team_id: assignment.team_id,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return {
    message: 'Pending team assignments processed',
    results
  };
}

/**
 * Remove member from team
 */
async function removeMemberFromTeam(teamId, userId) {
  // Check if membership exists
  const membership = await searchAll('user_teams', ['user_id', 'team_id'], [userId, teamId]);
  if (!membership || membership.length === 0) {
    throw new Error('User is not a member of this team');
  }
  
  await deleteFrom('user_teams', ['user_id', 'team_id'], [userId, teamId]);
  
  return { message: 'Member removed from team successfully' };
}

/**
 * Get team with members
 */
async function getTeamWithMembers(teamId) {
  const team = await search('teams', 'id', teamId);
  
  if (!team) {
    throw new Error('Team not found');
  }
  
  const members = await getTeamMembers(teamId);
  
  return {
    ...team,
    members
  };
}

/**
 * Get teams with member counts
 */
async function getTeamsWithMemberCounts() {
  const teams = await executeQuery(`
    SELECT t.*, COUNT(ut.user_id) as member_count
    FROM teams t
    LEFT JOIN user_teams ut ON t.id = ut.team_id
    GROUP BY t.id
    ORDER BY t.team_number
  `);
  
  return teams;
}

/**
 * Get team statistics
 */
async function getTeamStats() {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_teams,
      COUNT(DISTINCT ut.user_id) as total_members,
      AVG(member_count) as avg_members_per_team
    FROM teams t
    LEFT JOIN (
      SELECT team_id, COUNT(user_id) as member_count
      FROM user_teams
      GROUP BY team_id
    ) ut ON t.id = ut.team_id
  `);
  
  return stats[0];
}

/**
 * Check if user can access team
 */
async function canUserAccessTeam(userId, teamId) {
  // Admin and service accounts can access all teams
  const user = await search('users', 'id', userId);
  if (user && (user.role === 'ADMIN' || user.role === 'SERVICE_ACCOUNT')) {
    return true;
  }
  
  // Check if user is a member of the team
  const membership = await searchAll('user_teams', ['user_id', 'team_id'], [userId, teamId]);
  return !!(membership && membership.length > 0);
}

module.exports = {
  getAllTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addMemberToTeam,
  addUserToTeamByEmail,
  getPendingTeamAssignments,
  getAllPendingTeamAssignments,
  processPendingTeamAssignments,
  removeMemberFromTeam,
  getTeamWithMembers,
  getTeamsWithMemberCounts,
  getTeamStats,
  canUserAccessTeam
};
