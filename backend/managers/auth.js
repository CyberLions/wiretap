const { Issuer } = require('openid-client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { openidConfig, jwtConfig } = require('../utils/config');
const { search, insert, update } = require('../utils/db');

/**
 * Login with username and password
 */
async function loginWithPassword(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  // Find user by username
  const user = await search('users', 'username', username);
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Check if user is enabled
  if (!user.enabled) {
    throw new Error('Account is disabled');
  }
  
  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
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
  
  return {
    token,
    user: userInfo
  };
}

/**
 * Login with OpenID Connect
 */
async function loginWithOpenID(code, state) {
  try {
    // Verify state parameter
    if (state !== req.session.oauthState) {
      throw new Error('Invalid state parameter');
    }
    
    // Get OpenID issuer
    const issuer = await Issuer.discover(openidConfig.issuer);
    const client = new issuer.Client({
      client_id: openidConfig.clientId,
      client_secret: openidConfig.clientSecret,
      redirect_uris: [openidConfig.redirectUri],
      response_types: ['code']
    });
    
    // Exchange code for tokens
    const tokenSet = await client.callback(
      openidConfig.redirectUri,
      { code, state },
      { code_verifier: req.session.codeVerifier }
    );
    
    // Get user info
    const userInfo = await client.userinfo(tokenSet.access_token);
    
    // Find or create user
    let user = await search('users', 'openid_sub', userInfo.sub);
    
    if (!user) {
      // Create new user
      const userId = uuidv4();
      const newUser = {
        id: userId,
        username: userInfo.preferred_username || userInfo.email,
        email: userInfo.email,
        first_name: userInfo.given_name,
        last_name: userInfo.family_name,
        openid_sub: userInfo.sub,
        role: 'USER',
        enabled: true,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };
      
      await insert('users', Object.keys(newUser), Object.values(newUser));
      user = newUser;
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
    
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        enabled: user.enabled
      }
    };
  } catch (error) {
    throw new Error(`OpenID login failed: ${error.message}`);
  }
}

/**
 * Get OpenID authorization URL
 */
async function getOpenIDAuthUrl() {
  try {
    const issuer = await Issuer.discover(openidConfig.issuer);
    const client = new issuer.Client({
      client_id: openidConfig.clientId,
      client_secret: openidConfig.clientSecret,
      redirect_uris: [openidConfig.redirectUri],
      response_types: ['code']
    });
    
    const state = uuidv4();
    const codeVerifier = uuidv4();
    
    const authUrl = client.authorizationUrl({
      scope: openidConfig.scope,
      state,
      code_challenge: codeVerifier,
      code_challenge_method: 'S256'
    });
    
    return {
      authUrl,
      state,
      codeVerifier
    };
  } catch (error) {
    throw new Error(`Failed to generate OpenID auth URL: ${error.message}`);
  }
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, jwtConfig.secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Refresh JWT token
 */
function refreshToken(user) {
  const token = jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
  
  return { token };
}

/**
 * Change password
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await search('users', 'id', userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }
  
  // Hash new password
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // Update password
  await update('users', 'password_hash', newPasswordHash, 'id', userId);
  
  return { message: 'Password changed successfully' };
}

/**
 * Reset password (admin function)
 */
async function resetPassword(userId, newPassword) {
  const user = await search('users', 'id', userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Hash new password
  const saltRounds = 10;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // Update password
  await update('users', 'password_hash', newPasswordHash, 'id', userId);
  
  return { message: 'Password reset successfully' };
}

/**
 * Logout (invalidate token)
 */
function logout() {
  // In a stateless JWT system, logout is typically handled client-side
  // by removing the token. For additional security, you could implement
  // a token blacklist or use shorter expiration times.
  return { message: 'Logged out successfully' };
}

module.exports = {
  loginWithPassword,
  loginWithOpenID,
  getOpenIDAuthUrl,
  verifyToken,
  refreshToken,
  changePassword,
  resetPassword,
  logout
};
