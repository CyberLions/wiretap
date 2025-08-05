const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { authenticateToken, canAccessInstance } = require('../middleware/auth');
const { jwtConfig, vncConfig } = require('../utils/config');

/**
 * @swagger
 * /api/vnc/{instanceId}/console:
 *   post:
 *     summary: Create VNC console session
 *     tags: [VNC]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
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
 *               console_type:
 *                 type: string
 *                 enum: [NOVNC, VNC, SERIAL, SPICE, RDP, MKS]
 *                 default: NOVNC
 *     responses:
 *       200:
 *         description: Console session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session_token:
 *                   type: string
 *                 console_url:
 *                   type: string
 *                 expires_at:
 *                   type: string
 *       404:
 *         description: Instance not found
 */
router.post('/:instanceId/console', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { console_type = 'NOVNC' } = req.body;
    
    const instance = await search('instances', 'id', instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Check if instance is locked
    if (instance.locked && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Instance is locked' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Get console URL from OpenStack using project-specific authentication
    const { getConsoleUrlForProject } = require('../managers/openstack');
    const consoleUrl = await getConsoleUrlForProject(provider, workshop.openstack_project_name, instance, console_type);
    
    if (!consoleUrl) {
      return res.status(500).json({ error: 'Failed to get console URL' });
    }
    
    // Create session
    const sessionToken = jwt.sign(
      { 
        userId: req.user.id,
        instanceId,
        consoleType: console_type,
        type: 'vnc_session'
      },
      jwtConfig.secret,
      { expiresIn: '1h' }
    );
    
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + vncConfig.sessionTimeout);
    
    const sessionData = {
      id: sessionId,
      user_id: req.user.id,
      instance_id: instanceId,
      session_token: sessionToken,
      console_type,
      expires_at: expiresAt
    };
    
    await insert('sessions', Object.keys(sessionData), Object.values(sessionData));
    
    res.json({
      session_token: sessionToken,
      console_url: consoleUrl,
      expires_at: expiresAt.toISOString()
    });
    
  } catch (error) {
    console.error('Error creating console session:', error);
    res.status(500).json({ error: 'Failed to create console session' });
  }
});

/**
 * @swagger
 * /api/vnc/{instanceId}/console/refresh:
 *   post:
 *     summary: Refresh VNC console session
 *     tags: [VNC]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Console session refreshed
 *       404:
 *         description: Instance not found
 */
router.post('/:instanceId/console/refresh', authenticateToken, canAccessInstance, async (req, res) => {
  try {
    const { instanceId } = req.params;
    
    const instance = await search('instances', 'id', instanceId);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Check if instance is locked
    if (instance.locked && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Instance is locked' });
    }
    
    // Get workshop and provider info
    const workshop = await search('workshops', 'id', instance.workshop_id);
    const provider = await search('providers', 'id', workshop.provider_id);
    
    // Get console URL from OpenStack using project-specific authentication
    const { getConsoleUrlForProject } = require('../managers/openstack');
    const consoleUrl = await getConsoleUrlForProject(provider, workshop.openstack_project_name, instance, 'NOVNC');
    
    if (!consoleUrl) {
      return res.status(500).json({ error: 'Failed to get console URL' });
    }
    
    // Create new session token
    const sessionToken = jwt.sign(
      { 
        userId: req.user.id,
        instanceId,
        consoleType: 'VNC',
        type: 'vnc_session'
      },
      jwtConfig.secret,
      { expiresIn: '1h' }
    );
    
    // Update existing session or create new one
    const existingSession = await searchAll('sessions', ['user_id', 'instance_id'], [req.user.id, instanceId]);
    
    if (existingSession.length > 0) {
      // Update existing session
      await update('sessions', 'session_token', sessionToken, ['user_id', 'instance_id'], [req.user.id, instanceId]);
      await update('sessions', 'expires_at', new Date(Date.now() + vncConfig.sessionTimeout), ['user_id', 'instance_id'], [req.user.id, instanceId]);
    } else {
      // Create new session
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + vncConfig.sessionTimeout);
      
      const sessionData = {
        id: sessionId,
        user_id: req.user.id,
        instance_id: instanceId,
        session_token: sessionToken,
        console_type: 'VNC',
        expires_at: expiresAt
      };
      
      await insert('sessions', Object.keys(sessionData), Object.values(sessionData));
    }
    
    res.json({
      session_token: sessionToken,
      console_url: consoleUrl,
      expires_at: new Date(Date.now() + vncConfig.sessionTimeout).toISOString()
    });
    
  } catch (error) {
    console.error('Error refreshing console session:', error);
    res.status(500).json({ error: 'Failed to refresh console session' });
  }
});

/**
 * @swagger
 * /api/vnc/sessions:
 *   get:
 *     summary: Get user's active VNC sessions
 *     tags: [VNC]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await searchAll('sessions', ['user_id'], [req.user.id]);
    
    // Filter out expired sessions
    const now = new Date();
    const activeSessions = sessions.filter(session => new Date(session.expires_at) > now);
    
    res.json(activeSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * @swagger
 * /api/vnc/sessions/{sessionId}:
 *   delete:
 *     summary: Close VNC session
 *     tags: [VNC]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session closed successfully
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await search('sessions', 'id', sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if user owns this session or is admin
    if (session.user_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied to session' });
    }
    
    await deleteFrom('sessions', ['id'], [sessionId]);
    
    res.json({ message: 'Session closed successfully' });
  } catch (error) {
    console.error('Error closing session:', error);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

/**
 * @swagger
 * /api/vnc/verify:
 *   post:
 *     summary: Verify VNC session token
 *     tags: [VNC]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_token
 *             properties:
 *               session_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Invalid token
 */
router.post('/verify', async (req, res) => {
  try {
    const { session_token } = req.body;
    
    if (!session_token) {
      return res.status(400).json({ error: 'Session token is required' });
    }
    
    const decoded = jwt.verify(session_token, jwtConfig.secret);
    
    if (decoded.type !== 'vnc_session') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Check if session exists in database
    const session = await searchAll('sessions', ['session_token'], [session_token]);
    
    if (session.length === 0) {
      return res.status(401).json({ error: 'Session not found' });
    }
    
    // Check if session is expired
    const sessionData = session[0];
    if (new Date(sessionData.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    res.json({
      valid: true,
      userId: decoded.userId,
      instanceId: decoded.instanceId,
      consoleType: decoded.consoleType
    });
    
  } catch (error) {
    console.error('Error verifying session token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router; 