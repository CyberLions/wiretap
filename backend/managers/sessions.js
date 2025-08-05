const { searchAll, deleteFrom } = require('../utils/db');

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  try {
    const now = new Date();
    
    // Get all sessions
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
    
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
    return cleanedCount;
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }
}

/**
 * Get active sessions for a user
 */
async function getUserActiveSessions(userId) {
  try {
    const sessions = await searchAll('sessions', ['user_id'], [userId]);
    const now = new Date();
    
    // Filter out expired sessions
    return sessions.filter(session => new Date(session.expires_at) > now);
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
}

/**
 * Get active sessions for an instance
 */
async function getInstanceActiveSessions(instanceId) {
  try {
    const sessions = await searchAll('sessions', ['instance_id'], [instanceId]);
    const now = new Date();
    
    // Filter out expired sessions
    return sessions.filter(session => new Date(session.expires_at) > now);
  } catch (error) {
    console.error('Error getting instance sessions:', error);
    return [];
  }
}

/**
 * Close all sessions for a user
 */
async function closeUserSessions(userId) {
  try {
    const sessions = await searchAll('sessions', ['user_id'], [userId]);
    
    for (const session of sessions) {
      await deleteFrom('sessions', ['id'], [session.id]);
    }
    
    console.log(`Closed ${sessions.length} sessions for user ${userId}`);
    return sessions.length;
  } catch (error) {
    console.error('Error closing user sessions:', error);
    return 0;
  }
}

/**
 * Close all sessions for an instance
 */
async function closeInstanceSessions(instanceId) {
  try {
    const sessions = await searchAll('sessions', ['instance_id'], [instanceId]);
    
    for (const session of sessions) {
      await deleteFrom('sessions', ['id'], [session.id]);
    }
    
    console.log(`Closed ${sessions.length} sessions for instance ${instanceId}`);
    return sessions.length;
  } catch (error) {
    console.error('Error closing instance sessions:', error);
    return 0;
  }
}

/**
 * Get session statistics
 */
async function getSessionStats() {
  try {
    const allSessions = await searchAll('sessions', [], [], { orderBy: 'created_at' });
    const now = new Date();
    
    const activeSessions = allSessions.filter(session => new Date(session.expires_at) > now);
    const expiredSessions = allSessions.filter(session => new Date(session.expires_at) <= now);
    
    return {
      total: allSessions.length,
      active: activeSessions.length,
      expired: expiredSessions.length,
      vnc: allSessions.filter(s => s.console_type === 'VNC').length,
      serial: allSessions.filter(s => s.console_type === 'SERIAL').length
    };
  } catch (error) {
    console.error('Error getting session stats:', error);
    return {
      total: 0,
      active: 0,
      expired: 0,
      vnc: 0,
      serial: 0
    };
  }
}

module.exports = {
  cleanupExpiredSessions,
  getUserActiveSessions,
  getInstanceActiveSessions,
  closeUserSessions,
  closeInstanceSessions,
  getSessionStats
}; 