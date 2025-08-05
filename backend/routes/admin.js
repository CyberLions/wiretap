const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { executeQuery, search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get admin statistics
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Admin statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [usersResult, teamsResult, workshopsResult, instancesResult] = await Promise.all([
      executeQuery('SELECT COUNT(*) as users FROM users'),
      executeQuery('SELECT COUNT(*) as teams FROM teams'),
      executeQuery('SELECT COUNT(*) as workshops FROM workshops'),
      executeQuery('SELECT COUNT(*) as instances FROM instances'),
    ]);
    
    const users = usersResult[0]?.users || 0;
    const teams = teamsResult[0]?.teams || 0;
    const workshops = workshopsResult[0]?.workshops || 0;
    const instances = instancesResult[0]?.instances || 0;
    res.json({ users, teams, workshops, instances });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: System logs
 */
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, user_id } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    
    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(user_id);
    }
    
    const logs = await executeQuery(
      `SELECT l.*, u.first_name, u.last_name, u.username 
       FROM logs l 
       LEFT JOIN users u ON l.user_id = u.id 
       ${whereClause} 
       ORDER BY l.timestamp DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    ) || [];
    
    const totalResult = await executeQuery(
      `SELECT COUNT(*) as total FROM logs ${whereClause}`,
      params
    );
    
    const total = totalResult && totalResult[0] ? totalResult[0].total : 0;
    
    // Format logs for frontend
    const formattedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      user: log.first_name && log.last_name ? `${log.first_name} ${log.last_name}` : log.username || 'System',
      type: log.type,
      action: log.action,
      ip_address: log.ip_address,
      details: log.details
    }));
    
    res.json({
      logs: formattedLogs,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * @swagger
 * /api/admin/instances/{id}/lockout:
 *   post:
 *     summary: Lock out an instance
 *     tags: [Admin]
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
 *         description: Instance locked out successfully
 */
router.post('/instances/:id/lockout', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    await update('instances', 'locked', true, 'id', id);
    
    res.json({ message: 'Instance locked out successfully' });
  } catch (error) {
    console.error('Error locking out instance:', error);
    res.status(500).json({ error: 'Failed to lock out instance' });
  }
});

/**
 * @swagger
 * /api/admin/instances/{id}/unlock:
 *   post:
 *     summary: Unlock an instance
 *     tags: [Admin]
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
 *         description: Instance unlocked successfully
 */
router.post('/instances/:id/unlock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    await update('instances', 'locked', false, 'id', id);
    
    res.json({ message: 'Instance unlocked successfully' });
  } catch (error) {
    console.error('Error unlocking instance:', error);
    res.status(500).json({ error: 'Failed to unlock instance' });
  }
});

/**
 * @swagger
 * /api/admin/service-accounts:
 *   get:
 *     summary: Get service accounts
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of service accounts
 */
router.get('/service-accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const serviceAccounts = await searchAll('service_accounts', [], [], { orderBy: 'created_at DESC' });
    res.json(serviceAccounts);
  } catch (error) {
    console.error('Error fetching service accounts:', error);
    res.status(500).json({ error: 'Failed to fetch service accounts' });
  }
});

/**
 * @swagger
 * /api/admin/service-accounts:
 *   post:
 *     summary: Create service account
 *     tags: [Admin]
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
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service account created successfully
 */
router.post('/service-accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const serviceAccountId = uuidv4();
    const apiKey = `sk-${uuidv4().replace(/-/g, '')}`;
    
    const serviceAccountData = {
      id: serviceAccountId,
      name,
      api_key: apiKey,
      created_at: new Date().toISOString(),
      last_used: null
    };
    
    await insert('service_accounts', Object.keys(serviceAccountData), Object.values(serviceAccountData));
    
    const newServiceAccount = await search('service_accounts', 'id', serviceAccountId);
    res.status(201).json(newServiceAccount);
  } catch (error) {
    console.error('Error creating service account:', error);
    res.status(500).json({ error: 'Failed to create service account' });
  }
});

/**
 * @swagger
 * /api/admin/service-accounts/{id}:
 *   delete:
 *     summary: Delete service account
 *     tags: [Admin]
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
 *         description: Service account deleted successfully
 */
router.delete('/service-accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const serviceAccount = await search('service_accounts', 'id', id);
    
    if (!serviceAccount) {
      return res.status(404).json({ error: 'Service account not found' });
    }
    
    await deleteFrom('service_accounts', ['id'], [id]);
    
    res.json({ message: 'Service account deleted successfully' });
  } catch (error) {
    console.error('Error deleting service account:', error);
    res.status(500).json({ error: 'Failed to delete service account' });
  }
});

module.exports = router;