const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');
const { authenticateToken, requireAdmin, canAccessWorkshop } = require('../middleware/auth');

/**
 * @swagger
 * /api/workshops:
 *   get:
 *     summary: Get all workshops
 *     tags: [Workshops]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of workshops
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   provider_id:
 *                     type: string
 *                   openstack_project_name:
 *                     type: string
 *                   enabled:
 *                     type: boolean
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    let workshops;
    
    // If user is admin, show all workshops with provider information
    if (req.user.role === 'ADMIN') {
      workshops = await executeQuery(`
        SELECT w.*, p.name as provider_name
        FROM workshops w
        LEFT JOIN providers p ON w.provider_id = p.id
        ORDER BY w.name
      `);
    } else {
      // Get workshops that user has access to with provider information
      const userTeams = await searchAll('user_teams', ['user_id'], [req.user.id]);
      const teamIds = userTeams.map(ut => ut.team_id);
      
      if (teamIds.length === 0) {
        workshops = [];
      } else {
        const teams = await searchAll('teams', ['id'], teamIds);
        const workshopIds = [...new Set(teams.map(team => team.workshop_id))];
        
        if (workshopIds.length === 0) {
          workshops = [];
        } else {
          const placeholders = workshopIds.map(() => '?').join(',');
          workshops = await executeQuery(`
            SELECT w.*, p.name as provider_name
            FROM workshops w
            LEFT JOIN providers p ON w.provider_id = p.id
            WHERE w.id IN (${placeholders})
            ORDER BY w.name
          `, workshopIds);
        }
      }
    }
    
    // Add teams data and instance count to each workshop
    for (const workshop of workshops) {
      const teams = await searchAll('teams', ['workshop_id'], [workshop.id], { orderBy: 'team_number' });
      workshop.teams = teams;
      
      // Calculate instance count for this workshop
      const instances = await searchAll('instances', ['workshop_id'], [workshop.id]);
      workshop.instance_count = instances.length;
    }
    
    res.json(workshops);
  } catch (error) {
    console.error('Error fetching workshops:', error);
    res.status(500).json({ error: 'Failed to fetch workshops' });
  }
});

/**
 * @swagger
 * /api/workshops/{id}:
 *   get:
 *     summary: Get workshop by ID
 *     tags: [Workshops]
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
 *         description: Workshop details
 *       404:
 *         description: Workshop not found
 */
router.get('/:id', authenticateToken, canAccessWorkshop, async (req, res) => {
  try {
    const { id } = req.params;
    const workshop = await search('workshops', 'id', id);
    
    if (!workshop) {
      return res.status(404).json({ error: 'Workshop not found' });
    }
    
    res.json(workshop);
  } catch (error) {
    console.error('Error fetching workshop:', error);
    res.status(500).json({ error: 'Failed to fetch workshop' });
  }
});

/**
 * @swagger
 * /api/workshops:
 *   post:
 *     summary: Create new workshop
 *     tags: [Workshops]
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
 *               - provider_id
 *               - openstack_project_name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Workshop 2024"
 *               description:
 *                 type: string
 *                 example: "Annual security workshop"
 *               provider_id:
 *                 type: string
 *                 example: "uuid-of-provider"
 *               openstack_project_name:
 *                 type: string
 *                 example: "workshop-2024"
 *     responses:
 *       201:
 *         description: Workshop created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, provider_id, openstack_project_name } = req.body;
    
    if (!name || !provider_id || !openstack_project_name) {
      return res.status(400).json({ 
        error: 'Name, provider_id, and openstack_project_name are required' 
      });
    }
    
    // Check if workshop name already exists
    const existingWorkshop = await search('workshops', 'name', name);
    if (existingWorkshop) {
      return res.status(409).json({ error: 'Workshop with this name already exists' });
    }
    
    // Verify provider exists
    const provider = await search('providers', 'id', provider_id);
    if (!provider) {
      return res.status(400).json({ error: 'Provider not found' });
    }
    
    // Get OpenStack project ID from provider
    const { getOpenStackProjectId } = require('../managers/openstack');
    const projectId = await getOpenStackProjectId(provider, openstack_project_name);
    
    if (!projectId) {
      return res.status(400).json({ error: 'OpenStack project not found' });
    }
    
    const workshopId = uuidv4();
    const workshopData = {
      id: workshopId,
      name,
      description: description || '',
      provider_id,
      openstack_project_id: projectId,
      openstack_project_name,
      enabled: true
    };
    
    await insert('workshops', Object.keys(workshopData), Object.values(workshopData));
    
    const newWorkshop = await search('workshops', 'id', workshopId);
    res.status(201).json(newWorkshop);
  } catch (error) {
    console.error('Error creating workshop:', error);
    res.status(500).json({ error: 'Failed to create workshop' });
  }
});

/**
 * @swagger
 * /api/workshops/{id}:
 *   put:
 *     summary: Update workshop
 *     tags: [Workshops]
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
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Workshop updated successfully
 *       404:
 *         description: Workshop not found
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const workshop = await search('workshops', 'id', id);
    
    if (!workshop) {
      return res.status(404).json({ error: 'Workshop not found' });
    }
    
    // Validate provider_id if it's being updated
    if (req.body.provider_id !== undefined) {
      const provider = await search('providers', 'id', req.body.provider_id);
      if (!provider) {
        return res.status(400).json({ error: 'Provider not found' });
      }
    }
    
    const updateFields = ['name', 'description', 'provider_id', 'openstack_project_name', 'enabled'];
    
    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        await update('workshops', field, req.body[field], 'id', id);
      }
    }
    
    const updatedWorkshop = await search('workshops', 'id', id);
    res.json(updatedWorkshop);
  } catch (error) {
    console.error('Error updating workshop:', error);
    res.status(500).json({ error: 'Failed to update workshop' });
  }
});

/**
 * @swagger
 * /api/workshops/{id}:
 *   delete:
 *     summary: Delete workshop
 *     tags: [Workshops]
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
 *         description: Workshop deleted successfully
 *       404:
 *         description: Workshop not found
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const workshop = await search('workshops', 'id', id);
    if (!workshop) {
      return res.status(404).json({ error: 'Workshop not found' });
    }
    // Find all teams in this workshop
    const teams = await searchAll('teams', ['workshop_id'], [id]);
    const teamIds = teams.map(t => t.id);
    // Find all users with @workshop.local emails in these teams
    let usersToDelete = [];
    if (teamIds.length > 0) {
      const userTeams = await searchAll('user_teams', ['team_id'], [teamIds]);
      const userIds = userTeams.map(ut => ut.user_id);
      if (userIds.length > 0) {
        // Only delete users with @workshop.local emails (generated users)
        for (const userId of userIds) {
          const user = await search('users', 'id', userId);
          if (user && user.email && user.email.endsWith('@workshop.local')) {
            usersToDelete.push(userId);
          }
        }
        // Delete user_teams entries for these users
        for (const userId of usersToDelete) {
          await deleteFrom('user_teams', ['user_id'], [userId]);
        }
        // Delete users
        for (const userId of usersToDelete) {
          await deleteFrom('users', ['id'], [userId]);
        }
      }
      // Delete all user_teams for these teams
      await deleteFrom('user_teams', ['team_id'], [teamIds]);
      // Delete all teams
      await deleteFrom('teams', ['id'], [teamIds]);
    }
    // Delete all instances in this workshop
    await deleteFrom('instances', ['workshop_id'], [id]);
    // Delete the workshop
    await deleteFrom('workshops', ['id'], [id]);
    
    const message = usersToDelete.length > 0 
      ? `Workshop and related teams/instances deleted successfully. ${usersToDelete.length} generated user(s) with @workshop.local emails were also deleted.`
      : 'Workshop and related teams/instances deleted successfully.';
    
    res.json({ message });
  } catch (error) {
    console.error('Error deleting workshop:', error);
    res.status(500).json({ error: 'Failed to delete workshop' });
  }
});

/**
 * @swagger
 * /api/workshops/{id}/instances:
 *   get:
 *     summary: Get all instances in workshop
 *     tags: [Workshops]
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
 *         description: List of instances in workshop
 */
router.get('/:id/instances', authenticateToken, canAccessWorkshop, async (req, res) => {
  try {
    const { id } = req.params;
    const instances = await searchAll('instances', ['workshop_id'], [id], { orderBy: 'name' });
    
    res.json(instances);
  } catch (error) {
    console.error('Error fetching workshop instances:', error);
    res.status(500).json({ error: 'Failed to fetch workshop instances' });
  }
});

/**
 * @swagger
 * /api/workshops/{id}/teams:
 *   get:
 *     summary: Get all teams in workshop
 *     tags: [Workshops]
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
 *         description: List of teams in workshop
 */
router.get('/:id/teams', authenticateToken, canAccessWorkshop, async (req, res) => {
  try {
    const { id } = req.params;
    const teams = await searchAll('teams', ['workshop_id'], [id], { orderBy: 'team_number' });
    
    res.json(teams);
  } catch (error) {
    console.error('Error fetching workshop teams:', error);
    res.status(500).json({ error: 'Failed to fetch workshop teams' });
  }
});

module.exports = router; 