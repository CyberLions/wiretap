const express = require('express');
const router = express.Router();
const { Issuer } = require('openid-client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { openidConfig, jwtConfig } = require('../utils/config');
const { search, insert, update } = require('../utils/db');

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with username and password
 *     tags: [Authentication]
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
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user by username
    const user = await search('users', 'username', username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is enabled
    if (!user.enabled) {
      return res.status(401).json({ error: 'Account is disabled' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
    
    // Return user info (without password)
    const { password_hash, ...userInfo } = user;
    
    res.json({
      token,
      user: userInfo
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/openid/login:
 *   get:
 *     summary: Initiate OpenID Connect login
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to OpenID provider
 */
router.get('/openid/login', async (req, res) => {
  try {
    const issuer = await Issuer.discover(openidConfig.issuer);
    const client = new issuer.Client({
      client_id: openidConfig.clientId,
      client_secret: openidConfig.clientSecret,
      redirect_uris: [openidConfig.redirectUri],
      response_types: ['code']
    });
    
    const authUrl = client.authorizationUrl({
      scope: openidConfig.scope,
      state: uuidv4()
    });
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('OpenID login error:', error);
    res.status(500).json({ error: 'OpenID Connect not configured' });
  }
});

/**
 * @swagger
 * /api/auth/openid/callback:
 *   get:
 *     summary: Handle OpenID Connect callback
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Authentication successful
 *       400:
 *         description: Authentication failed
 */
router.get('/openid/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }
    
    const issuer = await Issuer.discover(openidConfig.issuer);
    const client = new issuer.Client({
      client_id: openidConfig.clientId,
      client_secret: openidConfig.clientSecret,
      redirect_uris: [openidConfig.redirectUri],
      response_types: ['code']
    });
    
    const tokenSet = await client.callback(openidConfig.redirectUri, { code, state }, { state });
    const userInfo = await client.userinfo(tokenSet.access_token);
    
    // Determine user role based on groups
    const userGroups = userInfo.groups || [];
    const isAdmin = userGroups.some(group => openidConfig.adminGroups.includes(group));
    const userRole = isAdmin ? 'ADMIN' : 'USER';
    
    // Find or create user
    let user = await search('users', 'openid_sub', userInfo.sub);
    
    if (!user) {
      // Create new user
      const userId = uuidv4();
      const userData = {
        id: userId,
        username: userInfo.preferred_username || userInfo.email,
        email: userInfo.email,
        first_name: userInfo.given_name || '',
        last_name: userInfo.family_name || '',
        role: userRole,
        auth_type: 'OPENID',
        openid_sub: userInfo.sub,
        openid_groups: JSON.stringify(userGroups),
        enabled: true
      };
      
      await insert('users', Object.keys(userData), Object.values(userData));
      user = await search('users', 'id', userId);
    } else {
      // Update existing user info and role
      const updateData = {
        email: userInfo.email,
        first_name: userInfo.given_name || user.first_name,
        last_name: userInfo.family_name || user.last_name,
        openid_groups: JSON.stringify(userGroups),
        role: userRole
      };
      
          await update('users', 'email', updateData.email, 'id', [user.id]);
    await update('users', 'first_name', updateData.first_name, 'id', [user.id]);
    await update('users', 'last_name', updateData.last_name, 'id', [user.id]);
    await update('users', 'openid_groups', updateData.openid_groups, 'id', [user.id]);
    await update('users', 'role', updateData.role, 'id', [user.id]);
      
      user = await search('users', 'id', user.id);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
    
    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5010';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    
  } catch (error) {
    console.error('OpenID callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 first_name:
 *                   type: string
 *                 last_name:
 *                   type: string
 *                 role:
 *                   type: string
 *                 enabled:
 *                   type: boolean
 *       401:
 *         description: Invalid token
 */


/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     description: Returns information about the currently authenticated user or service account
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                   nullable: true
 *                 first_name:
 *                   type: string
 *                   nullable: true
 *                 last_name:
 *                   type: string
 *                   nullable: true
 *                 role:
 *                   type: string
 *                 enabled:
 *                   type: boolean
 *                 isServiceAccount:
 *                   type: boolean
 *                 serviceAccountName:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Invalid token or API key
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    // Check if it's a service account API key (starts with 'sk-')
    if (authHeader.startsWith('sk-')) {
      const apiKey = authHeader;
      
      // Find service account by API key
      const serviceAccount = await search('service_accounts', 'api_key', apiKey);
      
      if (!serviceAccount || !serviceAccount.enabled) {
        return res.status(401).json({ error: 'Invalid or disabled service account' });
      }
      
             // Update last used timestamp - convert to MySQL datetime format
       const now = new Date();
       const mysqlDateTime = now.toISOString().slice(0, 19).replace('T', ' ');
       await update('service_accounts', 'last_used', mysqlDateTime, 'id', [serviceAccount.id]);
      
      // Return service account info
      res.json({
        id: serviceAccount.id,
        username: `service-${serviceAccount.name}`,
        email: null,
        first_name: null,
        last_name: null,
        role: 'SERVICE_ACCOUNT',
        enabled: serviceAccount.enabled,
        isServiceAccount: true,
        serviceAccountName: serviceAccount.name
      });
      
      return;
    }
    
    // Check if it's a JWT token (starts with 'Bearer ')
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }
    
    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    // Get user from database
    const user = await search('users', 'id', decoded.userId);
    
    if (!user || !user.enabled) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }
    
    const { password_hash, ...userInfo } = user;
    
    res.json({
      ...userInfo,
      isServiceAccount: false
    });
    
  } catch (error) {
    // Don't log JWT malformed errors as they're common and noisy
    if (error.name !== 'JsonWebTokenError' || error.message !== 'jwt malformed') {
      console.error('Get current user error:', error);
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: New token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid token
 */
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    // Allow refresh even if the access token is expired; we still verify signature
    const decoded = jwt.verify(token, jwtConfig.secret, { ignoreExpiration: true });
    
    // Get user from database
    const user = await search('users', 'id', decoded.userId);
    
    if (!user || !user.enabled) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }
    
    // Generate new JWT token
    const newToken = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );
    
    const { password_hash, ...userInfo } = user;
    
    res.json({
      token: newToken,
      user: userInfo
    });
    
  } catch (error) {
    // Don't log JWT malformed errors as they're common and noisy
    if (error.name !== 'JsonWebTokenError' || error.message !== 'jwt malformed') {
      console.error('Token refresh error:', error);
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify JWT token
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *       - ServiceAccountAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid token
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    // Get user from database
    const user = await search('users', 'id', decoded.userId);
    
    if (!user || !user.enabled) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }
    
    const { password_hash, ...userInfo } = user;
    
    res.json({
      valid: true,
      user: userInfo
    });
    
  } catch (error) {
    // Don't log JWT malformed errors as they're common and noisy
    if (error.name !== 'JsonWebTokenError' || error.message !== 'jwt malformed') {
      console.error('Token verification error:', error);
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // by removing the token
  res.json({ message: 'Logout successful' });
});

module.exports = router; 