const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { jwtConfig, vncConfig } = require('../utils/config');
const { getConsoleUrlForProject } = require('./openstack');

/**
 * Create VNC console session
 */
async function createConsoleSession(userId, instanceId, consoleType = 'NOVNC') {
  const instance = await search('instances', 'id', instanceId);
  if (!instance) {
    throw new Error('Instance not found');
  }
  
  // Check if instance is locked
  if (instance.locked) {
    throw new Error('Instance is locked');
  }
  
  // Get workshop and provider info
  const workshop = await search('workshops', 'id', instance.workshop_id);
  const provider = await search('providers', 'id', workshop.provider_id);
  
  // Get console URL from OpenStack using project-specific authentication
  const consoleUrl = await getConsoleUrlForProject(provider, workshop.openstack_project_name, instance, consoleType);
  
  if (!consoleUrl) {
    throw new Error('Failed to get console URL');
  }
  
  // Create session
  const sessionToken = jwt.sign(
    { 
      userId,
      instanceId,
      consoleType,
      type: 'vnc_session'
    },
    jwtConfig.secret,
    { expiresIn: '1h' }
  );
  
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + vncConfig.sessionTimeout);
  
  const sessionData = {
    id: sessionId,
    user_id: userId,
    instance_id: instanceId,
    session_token: sessionToken,
    console_type: consoleType,
    expires_at: expiresAt
  };
  
  await insert('sessions', Object.keys(sessionData), Object.values(sessionData));
  
  return {
    session_token: sessionToken,
    console_url: consoleUrl,
    expires_at: expiresAt
  };
}

/**
 * Get console session
 */
async function getConsoleSession(sessionToken) {
  const session = await search('sessions', 'session_token', sessionToken);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Check if session is expired
  if (new Date() > new Date(session.expires_at)) {
    await deleteFrom('sessions', ['id'], [session.id]);
    throw new Error('Session expired');
  }
  
  return session;
}

/**
 * Extend console session
 */
async function extendConsoleSession(sessionToken) {
  const session = await search('sessions', 'session_token', sessionToken);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Check if session is expired
  if (new Date() > new Date(session.expires_at)) {
    await deleteFrom('sessions', ['id'], [session.id]);
    throw new Error('Session expired');
  }
  
  // Extend session
  const newExpiresAt = new Date(Date.now() + vncConfig.sessionTimeout);
      await update('sessions', 'expires_at', newExpiresAt, 'id', [session.id]);
  
  return {
    session_token: sessionToken,
    expires_at: newExpiresAt
  };
}

/**
 * Close console session
 */
async function closeConsoleSession(sessionToken) {
  const session = await search('sessions', 'session_token', sessionToken);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  await deleteFrom('sessions', ['id'], [session.id]);
  
  return { message: 'Session closed successfully' };
}

/**
 * Get user's active sessions
 */
async function getUserSessions(userId) {
  const sessions = await searchAll('sessions', ['user_id'], [userId]);
  const now = new Date();
  
  // Filter out expired sessions
  return sessions.filter(session => new Date(session.expires_at) > now);
}

/**
 * Get instance's active sessions
 */
async function getInstanceSessions(instanceId) {
  const sessions = await searchAll('sessions', ['instance_id'], [instanceId]);
  const now = new Date();
  
  // Filter out expired sessions
  return sessions.filter(session => new Date(session.expires_at) > now);
}

/**
 * Get all active sessions
 */
async function getAllActiveSessions() {
  const sessions = await searchAll('sessions', [], [], { orderBy: 'created_at' });
  const now = new Date();
  
  // Filter out expired sessions
  return sessions.filter(session => new Date(session.expires_at) > now);
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  const now = new Date();
  const allSessions = await searchAll('sessions', [], [], { orderBy: 'created_at' });
  
  let cleanedCount = 0;
  
  for (const session of allSessions) {
    const expiresAt = new Date(session.expires_at);
    
    if (expiresAt < now) {
      // Delete expired session
      await deleteFrom('sessions', ['id'], [session.id]);
      cleanedCount++;
    }
  }
  
  return cleanedCount;
}

/**
 * Get session statistics
 */
async function getSessionStats() {
  const allSessions = await searchAll('sessions', [], [], { orderBy: 'created_at' });
  const now = new Date();
  
  const activeSessions = allSessions.filter(session => new Date(session.expires_at) > now);
  const expiredSessions = allSessions.filter(session => new Date(session.expires_at) <= now);
  
  return {
    total: allSessions.length,
    active: activeSessions.length,
    expired: expiredSessions.length,
    vnc: allSessions.filter(s => s.console_type === 'VNC').length,
    novnc: allSessions.filter(s => s.console_type === 'NOVNC').length,
    serial: allSessions.filter(s => s.console_type === 'SERIAL').length,
    spice: allSessions.filter(s => s.console_type === 'SPICE').length,
    rdp: allSessions.filter(s => s.console_type === 'RDP').length,
    mks: allSessions.filter(s => s.console_type === 'MKS').length
  };
}

/**
 * Verify session token
 */
function verifySessionToken(token) {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    if (decoded.type !== 'vnc_session') {
      throw new Error('Invalid session token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid session token');
  }
}

/**
 * Get console URL for instance
 */
async function getConsoleUrl(instanceId, consoleType = 'NOVNC') {
  const instance = await search('instances', 'id', instanceId);
  if (!instance) {
    throw new Error('Instance not found');
  }
  
  // Get workshop and provider info
  const workshop = await search('workshops', 'id', instance.workshop_id);
  const provider = await search('providers', 'id', workshop.provider_id);
  
  // Get console URL from OpenStack using project-specific authentication
  const consoleUrl = await getConsoleUrlForProject(provider, workshop.openstack_project_name, instance, consoleType);
  
  if (!consoleUrl) {
    throw new Error('Failed to get console URL');
  }
  
  return consoleUrl;
}

module.exports = {
  createConsoleSession,
  getConsoleSession,
  extendConsoleSession,
  closeConsoleSession,
  getUserSessions,
  getInstanceSessions,
  getAllActiveSessions,
  cleanupExpiredSessions,
  getSessionStats,
  verifySessionToken,
  getConsoleUrl
};
