const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { executeQuery, search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { utcToLocalDatetime, getCurrentUTCTime, getCurrentLocalTime } = require('../utils/timezone');
const { v4: uuidv4 } = require('uuid');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT token for authentication
 *   
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *     
 *     SuccessMessage:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Success message
 *     
 *     PaginationInfo:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: Total number of items
 *         page:
 *           type: integer
 *           description: Current page number
 *         limit:
 *           type: integer
 *           description: Number of items per page
 *     
 *     LogEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Log entry ID
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When the log entry was created
 *         user:
 *           type: string
 *           description: User who performed the action or 'System'
 *         type:
 *           type: string
 *           description: Type of log entry
 *         action:
 *           type: string
 *           description: Action performed
 *         ip_address:
 *           type: string
 *           description: IP address of the user
 *         details:
 *           type: string
 *           description: Additional details about the action
 *     
 *     ServiceAccount:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Service account ID
 *         name:
 *           type: string
 *           description: Service account name
 *         api_key:
 *           type: string
 *           description: API key for authentication
 *         last_used:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the service account was last used
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the service account was created
 *     
 *     LockoutSchedule:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Workshop ID
 *         name:
 *           type: string
 *           description: Workshop name
 *         lockout_start:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the lockout period starts
 *         lockout_end:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the lockout period ends
 *         nowLocked:
 *           type: boolean
 *           description: Whether the workshop is currently locked
 *         nextAction:
 *           type: object
 *           nullable: true
 *           properties:
 *             type:
 *               type: string
 *               enum: [lock, unlock]
 *               description: Type of next action
 *             at:
 *               type: string
 *               format: date-time
 *               description: When the next action will occur
 */

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get admin statistics
 *     description: Retrieves system-wide statistics including user, team, workshop, and instance counts
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: Admin statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: integer
 *                   description: Total number of users in the system
 *                   example: 150
 *                 teams:
 *                   type: integer
 *                   description: Total number of teams
 *                   example: 25
 *                 workshops:
 *                   type: integer
 *                   description: Total number of workshops
 *                   example: 10
 *                 instances:
 *                   type: integer
 *                   description: Total number of VM instances
 *                   example: 75
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Failed to fetch stats"
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
 *     description: Retrieves paginated system logs with optional filtering by type and user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of logs per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter logs by type (e.g., 'AUTH', 'INSTANCE', 'WORKSHOP')
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter logs by specific user ID
 *     responses:
 *       200:
 *         description: System logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: Log entry ID
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         description: When the log entry was created
 *                       user:
 *                         type: string
 *                         description: User who performed the action or 'System'
 *                       type:
 *                         type: string
 *                         description: Type of log entry
 *                       action:
 *                         type: string
 *                         description: Action performed
 *                       ip_address:
 *                         type: string
 *                         description: IP address of the user
 *                       details:
 *                         type: string
 *                         description: Additional details about the action
 *                 total:
 *                   type: integer
 *                   description: Total number of logs matching the filters
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 limit:
 *                   type: integer
 *                   description: Number of logs per page
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch logs"
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
 *     description: Locks a specific VM instance, preventing user access
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID to lock
 *     responses:
 *       200:
 *         description: Instance locked out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Instance locked out successfully"
 *       404:
 *         description: Instance not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Instance not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to lock out instance"
 */
router.post('/instances/:id/lockout', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    await update('instances', 'locked', true, 'id', [id]);
    
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
 *     description: Unlocks a specific VM instance, restoring user access
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Instance ID to unlock
 *     responses:
 *       200:
 *         description: Instance unlocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Instance unlocked successfully"
 *       404:
 *         description: Instance not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Instance not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to unlock instance"
 */
router.post('/instances/:id/unlock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const instance = await search('instances', 'id', id);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    await update('instances', 'locked', false, 'id', [id]);
    
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
 *     description: Retrieves a list of all service accounts in the system
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: Service accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     description: Service account ID
 *                   name:
 *                     type: string
 *                     description: Service account name
 *                   api_key:
 *                     type: string
 *                     description: API key for authentication
 *                   last_used:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     description: When the service account was last used
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     description: When the service account was created
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch service accounts"
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
 *     description: Creates a new service account with an automatically generated API key
 *     tags: [Admin]
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Name for the service account
 *                 example: "CI/CD Pipeline"
 *     responses:
 *       201:
 *         description: Service account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   description: Service account ID
 *                 name:
 *                   type: string
 *                   description: Service account name
 *                 api_key:
 *                   type: string
 *                   description: Generated API key for authentication
 *                 last_used:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                   description: When the service account was last used
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: When the service account was created
 *       400:
 *         description: Bad request - name is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Name is required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to create service account"
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
 *   put:
 *     summary: Update service account
 *     description: Updates the name of an existing service account
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service account ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name for the service account
 *     responses:
 *       200:
 *         description: Service account updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Service account updated successfully"
 *       400:
 *         description: Bad request - name is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Name is required"
 *       404:
 *         description: Service account not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service account not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to update service account"
 */
router.put('/service-accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const serviceAccount = await search('service_accounts', 'id', id);
    
    if (!serviceAccount) {
      return res.status(404).json({ error: 'Service account not found' });
    }
    
    await update('service_accounts', 'name', name, 'id', [id]);
    
    res.json({ message: 'Service account updated successfully' });
  } catch (error) {
    console.error('Error updating service account:', error);
    res.status(500).json({ error: 'Failed to update service account' });
  }
});

/**
 * @swagger
 * /api/admin/service-accounts/{id}:
 *   delete:
 *     summary: Delete service account
 *     description: Permanently deletes a service account and invalidates its API key
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service account ID to delete
 *     responses:
 *       200:
 *         description: Service account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Service account deleted successfully"
 *       404:
 *         description: Service account not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Service account not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to delete service account"
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

/**
 * @swagger
 * /api/admin/workshops/{id}/lock:
 *   post:
 *     summary: Lock all instances in a workshop
 *     description: Locks all VM instances in a workshop and terminates active sessions
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Workshop ID
 *     responses:
 *       200:
 *         description: Workshop locked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Workshop locked: all instances locked and sessions terminated"
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Workshop not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to lock workshop"
 */
router.post('/workshops/:id/lock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const workshop = await search('workshops', 'id', id);
    if (!workshop) return res.status(404).json({ error: 'Workshop not found' });
    await executeQuery('UPDATE instances SET locked = 1 WHERE workshop_id = ?', [id]);
    await executeQuery('DELETE FROM sessions WHERE instance_id IN (SELECT id FROM instances WHERE workshop_id = ?)', [id]);
    res.json({ message: 'Workshop locked: all instances locked and sessions terminated' });
  } catch (error) {
    console.error('Error locking workshop:', error);
    res.status(500).json({ error: 'Failed to lock workshop' });
  }
});

/**
 * @swagger
 * /api/admin/workshops/{id}/unlock:
 *   post:
 *     summary: Unlock all instances in a workshop
 *     description: Unlocks all VM instances in a workshop
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Workshop ID
 *     responses:
 *       200:
 *         description: Workshop unlocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Workshop unlocked: all instances unlocked"
 *       404:
 *         description: Workshop not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Workshop not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to unlock workshop"
 */
router.post('/workshops/:id/unlock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const workshop = await search('workshops', 'id', id);
    if (!workshop) return res.status(404).json({ error: 'Workshop not found' });
    await executeQuery('UPDATE instances SET locked = 0 WHERE workshop_id = ?', [id]);
    res.json({ message: 'Workshop unlocked: all instances unlocked' });
  } catch (error) {
    console.error('Error unlocking workshop:', error);
    res.status(500).json({ error: 'Failed to unlock workshop' });
  }
});

/**
 * @swagger
 * /api/admin/lockouts:
 *   get:
 *     summary: Get lockout schedule for all workshops
 *     description: Retrieves the current lockout schedule and status for all workshops
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: Lockout schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 now:
 *                   type: string
 *                   format: date-time
 *                   description: Current server time in ISO format
 *                   example: "2024-01-15T10:30:00.000Z"
 *                 schedule:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: Workshop ID
 *                       name:
 *                         type: string
 *                         description: Workshop name
 *                       lockout_start:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: When the lockout period starts
 *                       lockout_end:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: When the lockout period ends
 *                       nowLocked:
 *                         type: boolean
 *                         description: Whether the workshop is currently locked
 *                       nextAction:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [lock, unlock]
 *                             description: Type of next action
 *                           at:
 *                             type: string
 *                             format: date-time
 *                             description: When the next action will occur
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch lockout schedule"
 */
router.get('/lockouts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const workshops = await executeQuery('SELECT id, name, lockout_start, lockout_end FROM workshops ORDER BY name');
    const now = new Date();
    
    // Get user's timezone offset for display purposes
    const userTimezoneOffset = req.headers['x-timezone-offset'] ? 
      parseInt(req.headers['x-timezone-offset']) : 0;
    
    const schedule = workshops.map(w => {
      // Safely handle null or invalid dates
      let start = null;
      let end = null;
      
      if (w.lockout_start) {
        const startDate = new Date(w.lockout_start);
        start = !isNaN(startDate) ? startDate : null;
      }
      
      if (w.lockout_end) {
        const endDate = new Date(w.lockout_end);
        end = !isNaN(endDate) ? endDate : null;
      }
      
      const hasStart = start !== null;
      const hasEnd = end !== null;
      
      let nowLocked = false;
      if ((hasStart && now < start) || (hasEnd && now >= end)) {
        nowLocked = true;
      }
      
      let nextAction = null;
      if (hasStart && now < start) {
        nextAction = { type: 'unlock', at: start.toISOString() };
      } else if (hasEnd && now < end) {
        nextAction = { type: 'lock', at: end.toISOString() };
      }
      
      return { 
        id: w.id, 
        name: w.name, 
        lockout_start: w.lockout_start, 
        lockout_end: w.lockout_end,
        lockout_start_local: start ? utcToLocalDatetime(w.lockout_start, userTimezoneOffset) : null,
        lockout_end_local: end ? utcToLocalDatetime(w.lockout_end, userTimezoneOffset) : null,
        nowLocked, 
        nextAction 
      };
    });
    
    res.json({ 
      now: getCurrentUTCTime(), 
      now_local: getCurrentLocalTime(userTimezoneOffset),
      server_timezone: 'UTC',
      user_timezone_offset: userTimezoneOffset,
      schedule 
    });
  } catch (error) {
    console.error('Error fetching lockout schedule:', error);
    res.status(500).json({ error: 'Failed to fetch lockout schedule' });
  }
});

/**
 * @swagger
 * /api/admin/logs/cleanup:
 *   post:
 *     summary: Clean up old logs
 *     description: Deletes logs older than a specified number of days (default: 7 days)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 default: 7
 *                 description: Number of days to keep logs (logs older than this will be deleted)
 *     responses:
 *       200:
 *         description: Logs cleaned up successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cleaned up logs older than 7 days"
 *                 deleted_count:
 *                   type: integer
 *                   description: Number of log entries deleted
 *       400:
 *         description: Invalid days parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Days must be between 1 and 365"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to cleanup logs"
 */
router.post('/logs/cleanup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.body;
    
    // Validate days parameter
    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365' });
    }
    
    const { cleanupOldLogs } = require('../managers/admin');
    const result = await cleanupOldLogs(days);
    
    res.json(result);
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    res.status(500).json({ error: 'Failed to cleanup logs' });
  }
});

module.exports = router;