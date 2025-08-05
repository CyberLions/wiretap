const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { authenticateToken, requireAdmin, canAccessWorkshop } = require('../middleware/auth');

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Get all teams
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of teams
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    let teams;
    
    // If user is admin, show all teams
    if (req.user.role === 'ADMIN') {
      teams = await searchAll('teams', [], [], { orderBy: 'team_number' });
    } else {
      // Get teams that user belongs to
      const userTeams = await searchAll('user_teams', ['user_id'], [req.user.id]);
      const teamIds = userTeams.map(ut => ut.team_id);
      
      if (teamIds.length === 0) {
        teams = [];
      } else {
        teams = await searchAll('teams', ['id'], teamIds, { orderBy: 'team_number' });
      }
    }
    
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get team by ID
 *     tags: [Teams]
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
 *         description: Team details
 *       404:
 *         description: Team not found
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const team = await search('teams', 'id', id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Check if user has access to this team
    if (req.user.role !== 'ADMIN') {
      const userTeam = await searchAll('user_teams', ['user_id', 'team_id'], [req.user.id, id]);
      if (userTeam.length === 0) {
        return res.status(403).json({ error: 'Access denied to team' });
      }
    }
    
    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create new team
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - workshop_id
 *               - team_number
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Team Alpha"
 *               description:
 *                 type: string
 *                 example: "Advanced security team"
 *               workshop_id:
 *                 type: string
 *                 example: "uuid-of-workshop"
 *               team_number:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, workshop_id, team_number } = req.body;
    
    if (!name || !workshop_id || team_number === undefined) {
      return res.status(400).json({ 
        error: 'Name, workshop_id, and team_number are required' 
      });
    }
    
    // Verify workshop exists
    const workshop = await search('workshops', 'id', workshop_id);
    if (!workshop) {
      return res.status(400).json({ error: 'Workshop not found' });
    }
    
    // Check if team number already exists in this workshop
    const existingTeam = await searchAll('teams', ['workshop_id', 'team_number'], [workshop_id, team_number]);
    if (existingTeam.length > 0) {
      return res.status(409).json({ error: 'Team number already exists in this workshop' });
    }
    
    const teamId = uuidv4();
    const teamData = {
      id: teamId,
      name,
      description: description || '',
      workshop_id,
      team_number,
      enabled: true
    };
    
    await insert('teams', Object.keys(teamData), Object.values(teamData));
    
    const newTeam = await search('teams', 'id', teamId);
    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   put:
 *     summary: Update team
 *     tags: [Teams]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               team_number:
 *                 type: integer
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Team updated successfully
 *       404:
 *         description: Team not found
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const team = await search('teams', 'id', id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const updateFields = ['name', 'description', 'team_number', 'enabled'];
    
    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        await update('teams', 'id', id, field, req.body[field]);
      }
    }
    
    const updatedTeam = await search('teams', 'id', id);
    res.json(updatedTeam);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   delete:
 *     summary: Delete team
 *     tags: [Teams]
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
 *         description: Team deleted successfully
 *       404:
 *         description: Team not found
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const team = await search('teams', 'id', id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Check if team has instances
    const instances = await searchAll('instances', ['team_id'], [id]);
    if (instances.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete team with instances. Reassign instances first.' 
      });
    }
    
    // Remove all user associations
    await deleteFrom('user_teams', ['team_id'], [id]);
    
    // Delete team
    await deleteFrom('teams', ['id'], [id]);
    
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

/**
 * @swagger
 * /api/teams/{id}/users:
 *   get:
 *     summary: Get all users in team
 *     tags: [Teams]
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
 *         description: List of users in team
 */
router.get('/:id/users', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const team = await search('teams', 'id', id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Check if user has access to this team
    if (req.user.role !== 'ADMIN') {
      const userTeam = await searchAll('user_teams', ['user_id', 'team_id'], [req.user.id, id]);
      if (userTeam.length === 0) {
        return res.status(403).json({ error: 'Access denied to team' });
      }
    }
    
    const userTeams = await searchAll('user_teams', ['team_id'], [id]);
    const userIds = userTeams.map(ut => ut.user_id);
    
    if (userIds.length === 0) {
      res.json([]);
      return;
    }
    
    const users = await searchAll('users', ['id'], userIds, { orderBy: 'username' });
    
    // Remove sensitive information
    const sanitizedUsers = users.map(user => {
      const { password_hash, ...sanitized } = user;
      return sanitized;
    });
    
    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching team users:', error);
    res.status(500).json({ error: 'Failed to fetch team users' });
  }
});

/**
 * @swagger
 * /api/teams/{id}/users:
 *   post:
 *     summary: Add user to team
 *     tags: [Teams]
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
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: string
 *                 example: "uuid-of-user"
 *     responses:
 *       200:
 *         description: User added to team successfully
 *       400:
 *         description: Invalid input
 */
router.post('/:id/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    // Verify team exists
    const team = await search('teams', 'id', id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Verify user exists
    const user = await search('users', 'id', user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is already in team
    const existingUserTeam = await searchAll('user_teams', ['user_id', 'team_id'], [user_id, id]);
    if (existingUserTeam.length > 0) {
      return res.status(409).json({ error: 'User is already in this team' });
    }
    
    const userTeamId = uuidv4();
    const userTeamData = {
      id: userTeamId,
      user_id,
      team_id: id
    };
    
    await insert('user_teams', Object.keys(userTeamData), Object.values(userTeamData));
    
    res.json({ message: 'User added to team successfully' });
  } catch (error) {
    console.error('Error adding user to team:', error);
    res.status(500).json({ error: 'Failed to add user to team' });
  }
});

/**
 * @swagger
 * /api/teams/{id}/users/{userId}:
 *   delete:
 *     summary: Remove user from team
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User removed from team successfully
 *       404:
 *         description: Team or user not found
 */
router.delete('/:id/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    // Verify team exists
    const team = await search('teams', 'id', id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Verify user exists
    const user = await search('users', 'id', userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove user from team
    await deleteFrom('user_teams', ['user_id', 'team_id'], [userId, id]);
    
    res.json({ message: 'User removed from team successfully' });
  } catch (error) {
    console.error('Error removing user from team:', error);
    res.status(500).json({ error: 'Failed to remove user from team' });
  }
});

module.exports = router; 