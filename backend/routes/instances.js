const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin, canAccessInstance } = require('../middleware/auth');
const { search } = require('../utils/db');
const {
  getAllInstances,
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  syncInstance,
  syncAllInstances
} = require('../managers/instances');

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
    const filters = {
      workshop: req.query.workshop,
      status: req.query.status,
      power_state: req.query.power_state,
      team: req.query.team,
      competition: req.query.competition
    };
    
    const instances = await getAllInstances(req.user, filters);
    res.json(instances);
  } catch (error) {
    console.error('Error fetching instances:', error);
    res.status(500).json({ error: 'Failed to fetch instances' });
  }
});

/**
 * @swagger
 * /api/instances/sync:
 *   post:
 *     summary: Sync all instances with OpenStack
 *     description: Synchronizes the status, power state, and IP addresses of all instances with their current state in OpenStack
 *     tags: [Instances]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Instances synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Instances synced successfully"
 *                 synced_count:
 *                   type: number
 *                   example: 10
 *                 error_count:
 *                   type: number
 *                   example: 2
 *                 total_instances:
 *                   type: number
 *                   example: 12
 *       500:
 *         description: Failed to sync instances
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to sync instances"
 */
// Sync instances from OpenStack
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await syncAllInstances();
    res.json(result);
  } catch (error) {
    console.error('Error syncing instances:', error);
    res.status(500).json({ error: 'Failed to sync instances' });
  }
});

/**
 * @swagger
 * /api/instances/sync-scheduled:
 *   post:
 *     summary: Trigger scheduled instance sync
 *     description: Manually triggers the scheduled instance status update task that runs every 2 minutes
 *     tags: [Instances]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled sync triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Scheduled sync triggered successfully"
 *       500:
 *         description: Failed to trigger scheduled sync
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to trigger scheduled sync"
 */
router.post('/sync-scheduled', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { updateInstanceStatuses } = require('../managers/openstack');
    
    console.log('Manually triggering scheduled instance sync...');
    await updateInstanceStatuses();
    
    res.json({ message: 'Scheduled sync triggered successfully' });
  } catch (error) {
    console.error('Error triggering scheduled sync:', error);
    res.status(500).json({ error: 'Failed to trigger scheduled sync' });
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
    const instance = await getInstanceById(id);
    
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
    const newInstance = await createInstance(req.body);
    res.status(201).json(newInstance);
  } catch (error) {
    console.error('Error creating instance:', error);
    if (error.message.includes('required') || error.message.includes('not found') || error.message.includes('already exists')) {
      return res.status(400).json({ error: error.message });
    }
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
    const updatedInstance = await updateInstance(id, req.body);
    res.json(updatedInstance);
  } catch (error) {
    console.error('Error updating instance:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
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
    const result = await deleteInstance(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting instance:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
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
 * /api/instances/{id}/sync:
 *   post:
 *     summary: Sync single instance with OpenStack
 *     description: Synchronizes the status, power state, and IP addresses of a single instance with its current state in OpenStack
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
 *         description: Instance synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Instance synced successfully"
 *                 instance:
 *                   type: object
 *       404:
 *         description: Instance not found
 *       500:
 *         description: Failed to sync instance
 */
router.post('/:id/sync', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await syncInstance(id);
    res.json(result);
  } catch (error) {
    console.error('Error syncing instance:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to sync instance' });
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