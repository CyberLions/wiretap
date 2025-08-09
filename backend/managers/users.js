const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');
const { processPendingTeamAssignments } = require('./teams');

/**
 * Get all users
 */
async function getAllUsers() {
  const users = await searchAll('users', [], [], { orderBy: 'username' });
  
  // Remove sensitive information
  return users.map(user => {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  });
}

/**
 * Get user by ID
 */
async function getUserById(id) {
  const user = await search('users', 'id', id);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Remove sensitive information
  const { password_hash, ...sanitized } = user;
  return sanitized;
}

/**
 * Get user by username
 */
async function getUserByUsername(username) {
  const user = await search('users', 'username', username);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return user; // Return full user object for internal use
}

/**
 * Create new user
 */
async function createUser(userData) {
  const { username, password, email, first_name, last_name, role = 'USER' } = userData;
  
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  // Check if username already exists
  const existingUser = await search('users', 'username', username);
  if (existingUser) {
    throw new Error('Username already exists');
  }
  
  // Check if email already exists
  if (email) {
    const existingEmail = await search('users', 'email', email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }
  }
  
  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  const userId = uuidv4();
  const newUser = {
    id: userId,
    username,
    email: email || null,
    first_name: first_name || null,
    last_name: last_name || null,
    password_hash: passwordHash,
    role,
    enabled: true,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
  };
  
  await insert('users', Object.keys(newUser), Object.values(newUser));
  
  // Process any pending team assignments for this user
  let teamAssignmentResult = null;
  if (email) {
    try {
      teamAssignmentResult = await processPendingTeamAssignments(userId, email);
    } catch (error) {
      console.error('Error processing pending team assignments:', error);
      // Don't fail user creation if team assignment fails
    }
  }
  
  // Return sanitized user with team assignment info
  const { password_hash, ...sanitized } = newUser;
  return {
    ...sanitized,
    team_assignments: teamAssignmentResult
  };
}

/**
 * Update user
 */
async function updateUser(id, updateData) {
  const user = await search('users', 'id', id);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const updateFields = ['username', 'email', 'first_name', 'last_name', 'role', 'enabled'];
  
  for (const field of updateFields) {
    if (updateData[field] !== undefined) {
              await update('users', field, updateData[field], 'id', [id]);
    }
  }
  
  // Return updated user
  const updatedUser = await search('users', 'id', id);
  const { password_hash, ...sanitized } = updatedUser;
  return sanitized;
}

/**
 * Delete user
 */
async function deleteUser(id) {
  const user = await search('users', 'id', id);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  await deleteFrom('users', ['id'], [id]);
  
  return { message: 'User deleted successfully' };
}

/**
 * Change user password
 */
async function changeUserPassword(userId, currentPassword, newPassword) {
  const user = await search('users', 'id', userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }
  
  // Hash new password
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // Update password
  await update('users', 'password_hash', newPasswordHash, 'id', [userId]);
  
  return { message: 'Password changed successfully' };
}

/**
 * Reset user password (admin function)
 */
async function resetUserPassword(userId, newPassword) {
  const user = await search('users', 'id', userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Hash new password
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // Update password
  await update('users', 'password_hash', newPasswordHash, 'id', [userId]);
  
  return { message: 'Password reset successfully' };
}

/**
 * Enable/disable user
 */
async function toggleUserStatus(id, enabled) {
  const user = await search('users', 'id', id);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  await update('users', 'enabled', enabled, 'id', [id]);
  
  return { message: `User ${enabled ? 'enabled' : 'disabled'} successfully` };
}

/**
 * Get users with team information
 */
async function getUsersWithTeams() {
  const users = await executeQuery(`
    SELECT u.*, 
           GROUP_CONCAT(t.name) as team_names,
           GROUP_CONCAT(t.id) as team_ids
    FROM users u
    LEFT JOIN user_teams ut ON u.id = ut.user_id
    LEFT JOIN teams t ON ut.team_id = t.id
    GROUP BY u.id
    ORDER BY u.username
  `);
  
  // Remove sensitive information
  return users.map(user => {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  });
}

/**
 * Get user teams
 */
async function getUserTeams(userId) {
  const teams = await executeQuery(`
    SELECT t.*
    FROM teams t
    JOIN user_teams ut ON t.id = ut.team_id
    WHERE ut.user_id = ?
  `, [userId]);
  
  return teams;
}

/**
 * Add user to team
 */
async function addUserToTeam(userId, teamId) {
  // Check if user exists
  const user = await search('users', 'id', userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Check if team exists
  const team = await search('teams', 'id', teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Check if user is already in team
  const existingMembership = await searchAll('user_teams', ['user_id', 'team_id'], [userId, teamId]);
  if (existingMembership && existingMembership.length > 0) {
    throw new Error('User is already a member of this team');
  }
  
  const userTeamId = uuidv4();
  await insert('user_teams', ['id', 'user_id', 'team_id'], [userTeamId, userId, teamId]);
  
  return { message: 'User added to team successfully' };
}

/**
 * Remove user from team
 */
async function removeUserFromTeam(userId, teamId) {
  // Check if membership exists
  const membership = await searchAll('user_teams', ['user_id', 'team_id'], [userId, teamId]);
  if (!membership || membership.length === 0) {
    throw new Error('User is not a member of this team');
  }
  
  await deleteFrom('user_teams', ['user_id', 'team_id'], [userId, teamId]);
  
  return { message: 'User removed from team successfully' };
}

/**
 * Get user statistics
 */
async function getUserStats() {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_users,
      SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active_users,
      SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) as disabled_users,
      SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) as admin_users,
      SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) as regular_users
    FROM users
  `);
  
  return stats[0];
}

module.exports = {
  getAllUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  resetUserPassword,
  toggleUserStatus,
  getUsersWithTeams,
  getUserTeams,
  addUserToTeam,
  removeUserFromTeam,
  getUserStats
};
