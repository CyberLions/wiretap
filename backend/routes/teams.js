const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');
const { authenticateToken, requireAdmin, canAccessWorkshop } = require('../middleware/auth');
const { addUserToTeamByEmail, getAllPendingTeamAssignments } = require('../managers/teams');

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Get all teams
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
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
        // Use custom query for multiple team IDs
        const placeholders = teamIds.map(() => '?').join(',');
        const query = `SELECT * FROM teams WHERE id IN (${placeholders}) ORDER BY team_number`;
        teams = await executeQuery(query, teamIds);
      }
    }

    // Add workshop information, member count, and instance count to each team
    const teamsWithDetails = await Promise.all(
      teams.map(async (team) => {
        // Get workshop information
        const workshop = await search('workshops', 'id', team.workshop_id);
        
        // Get member count
        const userTeams = await searchAll('user_teams', ['team_id'], [team.id]);
        const memberCount = userTeams.length;
        
        // Get instance count for this team
        const instances = await searchAll('instances', ['team_id'], [team.id]);
        const instanceCount = instances.length;
        
        return {
          ...team,
          workshop: workshop ? { id: workshop.id, name: workshop.name } : null,
          workshop_name: workshop ? workshop.name : 'Unknown Workshop',
          member_count: memberCount,
          instance_count: instanceCount
        };
      })
    );
    
    res.json(teamsWithDetails);
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
 *       - ServiceAccountAuth: []
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
    
    // Get instance count for this team
    const instances = await searchAll('instances', ['team_id'], [id]);
    const instanceCount = instances.length;
    
    // Get member count for this team
    const userTeams = await searchAll('user_teams', ['team_id'], [id]);
    const memberCount = userTeams.length;
    
    // Get workshop information
    const workshop = await search('workshops', 'id', team.workshop_id);
    
    // Add instance count, member count, and workshop information to team data
    const teamWithDetails = {
      ...team,
      instance_count: instanceCount,
      member_count: memberCount,
      workshop_name: workshop ? workshop.name : 'Unknown Workshop'
    };
    
    res.json(teamWithDetails);
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
 *       - ServiceAccountAuth: []
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
    
    // Validate and convert team_number to integer
    const parsedTeamNumber = parseInt(team_number, 10);
    if (isNaN(parsedTeamNumber) || parsedTeamNumber < 1) {
      return res.status(400).json({ 
        error: 'team_number must be a positive integer' 
      });
    }
    
    // Verify workshop exists
    const workshop = await search('workshops', 'id', workshop_id);
    if (!workshop) {
      return res.status(400).json({ error: 'Workshop not found' });
    }
    
    // Check if team number already exists in this workshop
    const existingTeam = await searchAll('teams', ['workshop_id', 'team_number'], [workshop_id, parsedTeamNumber]);
    if (existingTeam.length > 0) {
      return res.status(409).json({ error: 'Team number already exists in this workshop' });
    }
    
    const teamId = uuidv4();
    const teamData = {
      id: teamId,
      name,
      description: description || '',
      workshop_id,
      team_number: parsedTeamNumber,
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
 *       - ServiceAccountAuth: []
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
    
    // Validate team_number if it's being updated
    if (req.body.team_number !== undefined) {
      const parsedTeamNumber = parseInt(req.body.team_number, 10);
      if (isNaN(parsedTeamNumber) || parsedTeamNumber < 1) {
        return res.status(400).json({ 
          error: 'team_number must be a positive integer' 
        });
      }
      
      // Check if the new team number already exists in this workshop
      const existingTeam = await searchAll('teams', ['workshop_id', 'team_number'], [team.workshop_id, parsedTeamNumber]);
      if (existingTeam.length > 0 && existingTeam[0].id !== id) {
        return res.status(409).json({ error: 'Team number already exists in this workshop' });
      }
      
      // Update with parsed value
      req.body.team_number = parsedTeamNumber;
    }
    
    const updateFields = ['name', 'description', 'team_number', 'enabled'];
    
    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        await update('teams', field, req.body[field], 'id', [id]);
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
 *       - ServiceAccountAuth: []
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
    
    res.json({ message });
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
 *       - ServiceAccountAuth: []
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
    
    // Use custom query for multiple user IDs
    const placeholders = userIds.map(() => '?').join(',');
    const query = `SELECT * FROM users WHERE id IN (${placeholders}) ORDER BY username`;
    const users = await executeQuery(query, userIds);
    
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
 *       - ServiceAccountAuth: []
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
 *       - ServiceAccountAuth: []
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

/**
 * @swagger
 * /api/teams/{id}/users/email:
 *   post:
 *     summary: Add user to team by email
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
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
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the user to add
 *     responses:
 *       200:
 *         description: User added to team or queued for future addition
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Team not found
 *       409:
 *         description: User already in team or already queued
 */
router.post('/:id/users/email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    
    // Use the teams manager function to handle the logic
    const result = await addUserToTeamByEmail(id, email);
    
    res.json(result);
  } catch (error) {
    console.error('Error adding user to team by email:', error);
    res.status(500).json({ error: error.message || 'Failed to add user to team' });
  }
});

/**
 * @swagger
 * /api/teams/pending-assignments:
 *   get:
 *     summary: Get all pending team assignments
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: List of all pending team assignments
 */
router.get('/pending-assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pendingAssignments = await getAllPendingTeamAssignments();
    
    // Add team and user details to each assignment
    const assignmentsWithDetails = await Promise.all(
      pendingAssignments.map(async (assignment) => {
        const team = await search('teams', 'id', assignment.team_id);
        return {
          ...assignment,
          team: team ? { id: team.id, name: team.name, team_number: team.team_number } : null
        };
      })
    );
    
    res.json({
      total_pending: assignmentsWithDetails.length,
      pending_assignments: assignmentsWithDetails
    });
  } catch (error) {
    console.error('Error fetching pending team assignments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pending team assignments' });
  }
});

/**
 * @swagger
 * /api/teams/{id}/pending-assignments:
 *   get:
 *     summary: Get pending team assignments for a specific team
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of pending team assignments for the specified team
 */
router.get('/:id/pending-assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get all pending assignments and filter by team
    const allPendingAssignments = await getAllPendingTeamAssignments();
    const teamPendingAssignments = allPendingAssignments.filter(
      assignment => assignment.team_id === id
    );
    
    res.json({
      team_id: id,
      total_pending: teamPendingAssignments.length,
      pending_assignments: teamPendingAssignments
    });
  } catch (error) {
    console.error('Error fetching pending team assignments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pending team assignments' });
  }
});

module.exports = router; 