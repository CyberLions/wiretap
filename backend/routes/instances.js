const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom, executeQuery } = require('../utils/db');
const { authenticateToken, requireAdmin, canAccessInstance } = require('../middleware/auth');

/**
 * @swagger
 * /api/instances:
 *   get:
 *     summary: Get all instances
 *     tags: [Instances]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of instances
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { workshop, status, power_state, team, competition } = req.query;
    let instances;
    let whereConditions = [];
    let params = [];
    
    // If user is admin, show all instances
    if (req.user.role === 'ADMIN') {
      let baseQuery = `
        SELECT i.*, 
               w.name as workshop_name,
               t.name as team_name,
               CONCAT(u.first_name, ' ', u.last_name) as user_name
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
      const userTeams = await searchAll('user_teams', ['user_id'], [req.user.id]);
      const teamIds = userTeams.map(ut => ut.team_id);
      
      // Get instances assigned to user or user's teams
      const userInstances = await searchAll('instances', ['user_id'], [req.user.id]);
      const teamInstances = teamIds.length > 0 ? 
        await searchAll('instances', ['team_id'], teamIds) : [];
      
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
                 CONCAT(u.first_name, ' ', u.last_name) as user_name
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
    
    res.json(instances);
  } catch (error) {
    console.error('Error fetching instances:', error);
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

/**
 * @swagger
 * /api/instances/{id}:
 *   get:
 *     summary: Get instance by ID
 *     tags: [Instances]
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
 *         description: Instance details
 *       404:
 *         description: Instance not found
 */
router.get('/:id', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const instances = await executeQuery(`
      SELECT i.*, 
             w.name as workshop_name,
             t.name as team_name,
             CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM instances i
      LEFT JOIN workshops w ON i.workshop_id = w.id
      LEFT JOIN teams t ON i.team_id = t.id
      LEFT JOIN users u ON i.user_id = u.id
      WHERE i.id = ?
    `, [id]);
    
    const instance = instances[0];
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    res.json(instance);
  } catch (error) {
    console.error('Error fetching instance:', error);
    res.status(500).json({ error: 'Failed to fetch instance' });
  }
});

/**
 * @swagger
 * /api/instances:
 *   post:
 *     summary: Create new instance
 *     tags: [Instances]
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
 *               - openstack_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: "web-server-01"
 *               workshop_id:
 *                 type: string
 *                 example: "uuid-of-workshop"
 *               openstack_id:
 *                 type: string
 *                 example: "uuid-from-openstack"
 *               team_id:
 *                 type: string
 *                 example: "uuid-of-team"
 *               user_id:
 *                 type: string
 *                 example: "uuid-of-user"
 *     responses:
 *       201:
 *         description: Instance created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, workshop_id, openstack_id, team_id, user_id } = req.body;
    
    if (!name || !workshop_id || !openstack_id) {
      return res.status(400).json({ 
        error: 'Name, workshop_id, and openstack_id are required' 
      });
    }
    
    // Verify workshop exists
    const workshop = await search('workshops', 'id', workshop_id);
    if (!workshop) {
      return res.status(400).json({ error: 'Workshop not found' });
    }
    
    // Check if OpenStack ID already exists
    const existingInstance = await search('instances', 'openstack_id', openstack_id);
    if (existingInstance) {
      return res.status(409).json({ error: 'Instance with this OpenStack ID already exists' });
    }
    
    const instanceId = uuidv4();
    const instanceData = {
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
    
    await insert('instances', Object.keys(instanceData), Object.values(instanceData));
    
    const newInstance = await search('instances', 'id', instanceId);
    res.status(201).json(newInstance);
  } catch (error) {
    console.error('Error creating instance:', error);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}:
 *   put:
 *     summary: Update instance
 *     tags: [Instances]
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
 *               team_id:
 *                 type: string
 *               user_id:
 *                 type: string
 *               locked:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Instance updated successfully
 *       404:
 *         description: Instance not found
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    const updateFields = ['name', 'team_id', 'user_id', 'locked'];
    
    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        await update('instances', 'id', id, field, req.body[field]);
      }
    }
    
    const updatedInstance = await search('instances', 'id', id);
    res.json(updatedInstance);
  } catch (error) {
    console.error('Error updating instance:', error);
    res.status(500).json({ error: 'Failed to update instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}:
 *   delete:
 *     summary: Delete instance
 *     tags: [Instances]
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
 *         description: Instance deleted successfully
 *       404:
 *         description: Instance not found
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    await deleteFrom('instances', ['id'], [id]);
    
    res.json({ message: 'Instance deleted successfully' });
  } catch (error) {
    console.error('Error deleting instance:', error);
    res.status(500).json({ error: 'Failed to delete instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/power/on:
 *   post:
 *     summary: Power on instance
 *     tags: [Instances]
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
 *         description: Instance powered on successfully
 *       404:
 *         description: Instance not found
 */
router.post('/:id/power/on', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Power on instance via OpenStack
    const { powerOnInstance } = require('../managers/openstack');
    await powerOnInstance(provider, instance);
    
    res.json({ message: 'Instance powered on successfully' });
  } catch (error) {
    console.error('Error powering on instance:', error);
    res.status(500).json({ error: 'Failed to power on instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/power/off:
 *   post:
 *     summary: Power off instance
 *     tags: [Instances]
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
 *         description: Instance powered off successfully
 *       404:
 *         description: Instance not found
 */
router.post('/:id/power/off', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Power off instance via OpenStack
    const { powerOffInstance } = require('../managers/openstack');
    await powerOffInstance(provider, instance);
    
    res.json({ message: 'Instance powered off successfully' });
  } catch (error) {
    console.error('Error powering off instance:', error);
    res.status(500).json({ error: 'Failed to power off instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/power/restart:
 *   post:
 *     summary: Restart instance
 *     tags: [Instances]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hard:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Instance restarted successfully
 *       404:
 *         description: Instance not found
 */
router.post('/:id/power/restart', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const { hard = false } = req.body;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Restart instance via OpenStack
    const { restartInstance } = require('../managers/openstack');
    await restartInstance(provider, instance, hard);
    
    res.json({ message: 'Instance restarted successfully' });
  } catch (error) {
    console.error('Error restarting instance:', error);
    res.status(500).json({ error: 'Failed to restart instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/status:
 *   get:
 *     summary: Get instance status
 *     tags: [Instances]
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
 *         description: Instance status
 *       404:
 *         description: Instance not found
 */
router.get('/:id/status', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Get instance status from OpenStack
    const { getInstanceStatus } = require('../managers/openstack');
    const status = await getInstanceStatus(provider, instance);
    
    res.json(status);
  } catch (error) {
    console.error('Error getting instance status:', error);
    res.status(500).json({ error: 'Failed to get instance status' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/power-on:
 *   post:
 *     summary: Power on instance (alternative endpoint)
 *     tags: [Instances]
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
 *         description: Instance powered on successfully
 *       404:
 *         description: Instance not found
 */
router.post('/:id/power-on', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Power on instance via OpenStack
    const { powerOnInstance } = require('../managers/openstack');
    await powerOnInstance(provider, instance);
    
    res.json({ message: 'Instance powered on successfully' });
  } catch (error) {
    console.error('Error powering on instance:', error);
    res.status(500).json({ error: 'Failed to power on instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/power-off:
 *   post:
 *     summary: Power off instance (alternative endpoint)
 *     tags: [Instances]
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
 *         description: Instance powered off successfully
 *       404:
 *         description: Instance not found
 */
router.post('/:id/power-off', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Power off instance via OpenStack
    const { powerOffInstance } = require('../managers/openstack');
    await powerOffInstance(provider, instance);
    
    res.json({ message: 'Instance powered off successfully' });
  } catch (error) {
    console.error('Error powering off instance:', error);
    res.status(500).json({ error: 'Failed to power off instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/reboot:
 *   post:
 *     summary: Reboot instance (alternative endpoint)
 *     tags: [Instances]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [soft, hard]
 *                 example: "soft"
 *     responses:
 *       200:
 *         description: Instance rebooted successfully
 *       404:
 *         description: Instance not found
 */
router.post('/:id/reboot', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'soft' } = req.body;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Restart instance via OpenStack
    const { restartInstance } = require('../managers/openstack');
    await restartInstance(provider, instance, type === 'hard');
    
    res.json({ message: 'Instance rebooted successfully' });
  } catch (error) {
    console.error('Error rebooting instance:', error);
    res.status(500).json({ error: 'Failed to reboot instance' });
  }
});

/**
 * @swagger
 * /api/instances/{id}/console:
 *   get:
 *     summary: Get console access for instance
 *     tags: [Instances]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [novnc, vnc, spice, serial, rdp, mks]
 *           default: novnc
 *     responses:
 *       200:
 *         description: Console access information
 *       404:
 *         description: Instance not found
 */
router.get('/:id/console', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'novnc' } = req.query;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Get console URL from OpenStack using project-specific authentication
    const { getConsoleUrlForProject } = require('../managers/openstack');
    const consoleUrl = await getConsoleUrlForProject(provider, workshop.openstack_project_name, instance, type);
    
    res.json({ console_url: consoleUrl });
  } catch (error) {
    console.error('Error getting console access:', error);
    res.status(500).json({ error: 'Failed to get console access' });
  }
});

module.exports = router; 