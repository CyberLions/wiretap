const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await searchAll('users', [], [], { orderBy: 'username' });
    
    // Remove sensitive information and convert boolean fields
    const sanitizedUsers = users.map(user => {
      const { password_hash, ...sanitized } = user;
      // Convert MySQL boolean (0/1) to actual boolean
      if (sanitized.enabled !== undefined) {
        sanitized.enabled = Boolean(sanitized.enabled);
      }
      return sanitized;
    });

    // Add team information for each user
    const usersWithTeams = await Promise.all(
      sanitizedUsers.map(async (user) => {
        const userTeams = await searchAll('user_teams', ['user_id'], [user.id]);
        const teamIds = userTeams.map(ut => ut.team_id);
        
        let teams = [];
        if (teamIds.length > 0) {
          // Use custom query for multiple team IDs
          const placeholders = teamIds.map(() => '?').join(',');
          const query = `SELECT * FROM teams WHERE id IN (${placeholders}) ORDER BY team_number`;
          teams = await executeQuery(query, teamIds);
          
          // Add workshop information to teams
          teams = await Promise.all(
            teams.map(async (team) => {
              const workshop = await search('workshops', 'id', team.workshop_id);
              return {
                ...team,
                workshop: workshop ? { id: workshop.id, name: workshop.name } : null
              };
            })
          );
        }
        
        return {
          ...user,
          teams
        };
      })
    );
    
    res.json(usersWithTeams);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await search('users', 'id', id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove sensitive information and convert boolean fields
    const { password_hash, ...sanitized } = user;
    // Convert MySQL boolean (0/1) to actual boolean
    if (sanitized.enabled !== undefined) {
      sanitized.enabled = Boolean(sanitized.enabled);
    }

    // Add team information
    const userTeams = await searchAll('user_teams', ['user_id'], [id]);
    const teamIds = userTeams.map(ut => ut.team_id);
    
    let teams = [];
    if (teamIds.length > 0) {
      // Use custom query for multiple team IDs
      const placeholders = teamIds.map(() => '?').join(',');
      const query = `SELECT * FROM teams WHERE id IN (${placeholders}) ORDER BY team_number`;
      teams = await executeQuery(query, teamIds);
      
      // Add workshop information to teams
      teams = await Promise.all(
        teams.map(async (team) => {
          const workshop = await search('workshops', 'id', team.workshop_id);
          return {
            ...team,
            workshop: workshop ? { id: workshop.id, name: workshop.name } : null
          };
        })
      );
    }
    
    const userWithTeams = {
      ...sanitized,
      teams
    };
    
    res.json(userWithTeams);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create new user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john.doe"
 *               email:
 *                 type: string
 *                 example: "john.doe@example.com"
 *               first_name:
 *                 type: string
 *                 example: "John"
 *               last_name:
 *                 type: string
 *                 example: "Doe"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *                 example: "USER"
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, first_name, last_name, password, role = 'USER' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }
    
    // Check if username already exists
    const existingUser = await search('users', 'username', username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Check if email already exists
    if (email) {
      const existingEmail = await search('users', 'email', email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }
    
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    
    const userData = {
      id: userId,
      username,
      email: email || null,
      first_name: first_name || '',
      last_name: last_name || '',
      role,
      auth_type: 'PASSWORD',
      password_hash: passwordHash,
      enabled: true
    };
    
    await insert('users', Object.keys(userData), Object.values(userData));
    
    const newUser = await search('users', 'id', userId);
    const { password_hash, ...sanitized } = newUser;
    
    res.status(201).json(sanitized);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await search('users', 'id', id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updateFields = ['username', 'email', 'first_name', 'last_name', 'role', 'enabled'];
    
    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        await update('users', field, req.body[field], 'id', id);
      }
    }
    
    const updatedUser = await search('users', 'id', id);
    const { password_hash, ...sanitized } = updatedUser;
    // Convert MySQL boolean (0/1) to actual boolean
    if (sanitized.enabled !== undefined) {
      sanitized.enabled = Boolean(sanitized.enabled);
    }

    // Add team information
    const userTeams = await searchAll('user_teams', ['user_id'], [id]);
    const teamIds = userTeams.map(ut => ut.team_id);
    
    let teams = [];
    if (teamIds.length > 0) {
      // Use custom query for multiple team IDs
      const placeholders = teamIds.map(() => '?').join(',');
      const query = `SELECT * FROM teams WHERE id IN (${placeholders}) ORDER BY team_number`;
      teams = await executeQuery(query, teamIds);
      
      // Add workshop information to teams
      teams = await Promise.all(
        teams.map(async (team) => {
          const workshop = await search('workshops', 'id', team.workshop_id);
          return {
            ...team,
            workshop: workshop ? { id: workshop.id, name: workshop.name } : null
          };
        })
      );
    }
    
    const userWithTeams = {
      ...sanitized,
      teams
    };
    
    res.json(userWithTeams);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await search('users', 'id', id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has assigned instances
    const instances = await searchAll('instances', ['user_id'], [id]);
    if (instances.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with assigned instances. Reassign instances first.' 
      });
    }
    
    // Remove all team associations
    await deleteFrom('user_teams', ['user_id'], [id]);
    
    // Delete user
    await deleteFrom('users', ['id'], [id]);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * @swagger
 * /api/users/generate:
 *   post:
 *     summary: Generate multiple users with team assignment
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - count
 *               - prefix
 *               - competitionId
 *               - usersPerTeam
 *             properties:
 *               count:
 *                 type: integer
 *                 example: 10
 *               prefix:
 *                 type: string
 *                 example: "user"
 *               competitionId:
 *                 type: string
 *                 example: "uuid-of-competition"
 *               usersPerTeam:
 *                 type: integer
 *                 example: 4
 *               password:
 *                 type: string
 *                 example: "password123"
 *               passwordLength:
 *                 type: integer
 *                 example: 12
 *     responses:
 *       201:
 *         description: Users generated successfully
 *       400:
 *         description: Invalid input
 */
router.post('/generate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      count, 
      prefix, 
      competitionId, 
      usersPerTeam, 
      password, 
      passwordLength = 12 
    } = req.body;
    
    if (!count || !prefix || !competitionId || !usersPerTeam) {
      return res.status(400).json({ 
        error: 'count, prefix, competitionId, and usersPerTeam are required' 
      });
    }
    
    if (count < 1 || count > 100) {
      return res.status(400).json({ 
        error: 'Count must be between 1 and 100' 
      });
    }
    
    if (usersPerTeam < 1 || usersPerTeam > 10) {
      return res.status(400).json({ 
        error: 'Users per team must be between 1 and 10' 
      });
    }
    
    // Verify competition exists
    const competition = await search('workshops', 'id', competitionId);
    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    
    // Calculate number of teams needed
    const numTeams = Math.ceil(count / usersPerTeam);
    
    // Create teams if they don't exist
    const createdTeams = [];
    for (let teamNum = 1; teamNum <= numTeams; teamNum++) {
      const teamName = `Team ${teamNum}`;
      
              // Check if team already exists for this competition
        const existingTeam = await executeQuery(
          'SELECT * FROM teams WHERE name = ? AND workshop_id = ?',
          [teamName, competitionId]
        );
        
        if (existingTeam.length === 0) {
          const teamId = uuidv4();
          const teamData = {
            id: teamId,
            name: teamName,
            team_number: teamNum,
            workshop_id: competitionId,
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };
          
          await insert('teams', Object.keys(teamData), Object.values(teamData));
          createdTeams.push({ id: teamId, name: teamName, team_number: teamNum });
        } else {
          createdTeams.push(existingTeam[0]);
        }
    }
    
    const createdUsers = [];
    let userIndex = 1;
    
    // Generate users and assign to teams
    for (let teamIndex = 0; teamIndex < createdTeams.length && userIndex <= count; teamIndex++) {
      const team = createdTeams[teamIndex];
      const usersForThisTeam = Math.min(usersPerTeam, count - userIndex + 1);
      
      for (let i = 0; i < usersForThisTeam; i++) {
        const username = `${prefix}${userIndex}`;
        
        // Check if username already exists
        const existingUser = await search('users', 'username', username);
        if (existingUser) {
          userIndex++;
          continue; // Skip if user already exists
        }
        
        // Generate password
        let userPassword;
        if (password) {
          userPassword = password;
        } else {
          // Generate random password
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
          userPassword = '';
          for (let j = 0; j < passwordLength; j++) {
            userPassword += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        }
        
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(userPassword, 10);
        
        const userData = {
          id: userId,
          username,
          email: `${username}@workshop.local`,
          first_name: `User`,
          last_name: `${userIndex}`,
          role: 'USER',
          auth_type: 'PASSWORD',
          password_hash: passwordHash,
          enabled: true,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
          updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
        
        await insert('users', Object.keys(userData), Object.values(userData));
        
        // Assign user to team
        const userTeamId = uuidv4();
        const userTeamData = {
          id: userTeamId,
          user_id: userId,
          team_id: team.id
        };
        
        await insert('user_teams', Object.keys(userTeamData), Object.values(userTeamData));
        
        const newUser = await search('users', 'id', userId);
        const { password_hash, ...sanitized } = newUser;
        createdUsers.push({
          ...sanitized,
          password: userPassword, // Include password in response for admin
          team: team.name,
          team_id: team.id
        });
        
        userIndex++;
      }
    }
    
    res.status(201).json({
      message: `${createdUsers.length} users generated successfully across ${createdTeams.length} teams`,
      users: createdUsers,
      teams: createdTeams
    });
  } catch (error) {
    console.error('Error generating users:', error);
    res.status(500).json({ error: 'Failed to generate users' });
  }
});

/**
 * @swagger
 * /api/users/bulk:
 *   post:
 *     summary: Create multiple users for a team
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team_id
 *               - count
 *               - prefix
 *             properties:
 *               team_id:
 *                 type: string
 *                 example: "uuid-of-team"
 *               count:
 *                 type: integer
 *                 example: 5
 *               prefix:
 *                 type: string
 *                 example: "student"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Users created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { team_id, count, prefix, password = 'password123' } = req.body;
    
    if (!team_id || !count || !prefix) {
      return res.status(400).json({ 
        error: 'team_id, count, and prefix are required' 
      });
    }
    
    if (count < 1 || count > 100) {
      return res.status(400).json({ 
        error: 'Count must be between 1 and 100' 
      });
    }
    
    // Verify team exists
    const team = await search('teams', 'id', team_id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const createdUsers = [];
    const passwordHash = await bcrypt.hash(password, 10);
    
    for (let i = 1; i <= count; i++) {
      const username = `${prefix}${i}`;
      
      // Check if username already exists
      const existingUser = await search('users', 'username', username);
      if (existingUser) {
        continue; // Skip if user already exists
      }
      
      const userId = uuidv4();
      const userData = {
        id: userId,
        username,
        email: `${username}@workshop.local`,
        first_name: `Student`,
        last_name: `${i}`,
        role: 'USER',
        auth_type: 'PASSWORD',
        password_hash: passwordHash,
        enabled: true
      };
      
      await insert('users', Object.keys(userData), Object.values(userData));
      
      // Add user to team
      const userTeamId = uuidv4();
      const userTeamData = {
        id: userTeamId,
        user_id: userId,
        team_id
      };
      
      await insert('user_teams', Object.keys(userTeamData), Object.values(userTeamData));
      
      const newUser = await search('users', 'id', userId);
      const { password_hash, ...sanitized } = newUser;
      createdUsers.push(sanitized);
    }
    
    res.status(201).json({
      message: `${createdUsers.length} users created successfully`,
      users: createdUsers
    });
  } catch (error) {
    console.error('Error creating bulk users:', error);
    res.status(500).json({ error: 'Failed to create users' });
  }
});

/**
 * @swagger
 * /api/users/{id}/teams:
 *   get:
 *     summary: Get all teams for a user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of teams for user
 */
router.get('/:id/teams', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await search('users', 'id', id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user can access this information
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const userTeams = await searchAll('user_teams', ['user_id'], [id]);
    const teamIds = userTeams.map(ut => ut.team_id);
    
    if (teamIds.length === 0) {
      res.json([]);
      return;
    }
    
    const teams = await searchAll('teams', ['id'], teamIds, { orderBy: 'team_number' });
    
    res.json(teams);
  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({ error: 'Failed to fetch user teams' });
  }
});

/**
 * @swagger
 * /api/users/{id}/password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       404:
 *         description: User not found
 *       400:
 *         description: Invalid input
 */
router.put('/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const user = await search('users', 'id', id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Update the password
    await update('users', 'password_hash', passwordHash, 'id', id);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await search('users', 'id', id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has assigned instances
    const instances = await searchAll('instances', ['user_id'], [id]);
    if (instances.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with assigned instances. Reassign instances first.' 
      });
    }
    
    // Remove all team associations
    await deleteFrom('user_teams', ['user_id'], [id]);
    
    // Delete user
    await deleteFrom('users', ['id'], [id]);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router; 