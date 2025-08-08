const { executeQuery, search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Get admin statistics
 */
async function getAdminStats() {
  const [usersResult, teamsResult, workshopsResult, instancesResult, providersResult] = await Promise.all([
    executeQuery('SELECT COUNT(*) as users FROM users'),
    executeQuery('SELECT COUNT(*) as teams FROM teams'),
    executeQuery('SELECT COUNT(*) as workshops FROM workshops'),
    executeQuery('SELECT COUNT(*) as instances FROM instances'),
    executeQuery('SELECT COUNT(*) as providers FROM providers')
  ]);
  
  const users = usersResult[0]?.users || 0;
  const teams = teamsResult[0]?.teams || 0;
  const workshops = workshopsResult[0]?.workshops || 0;
  const instances = instancesResult[0]?.instances || 0;
  const providers = providersResult[0]?.providers || 0;
  
  return { users, teams, workshops, instances, providers };
}

/**
 * Get system logs
 */
async function getSystemLogs(filters = {}) {
  const { page = 1, limit = 50, type, user_id } = filters;
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
  
  const total = totalResult[0]?.total || 0;
  
  return {
    logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Create system log
 */
async function createSystemLog(logData) {
  const { user_id, type, message, details, level = 'INFO' } = logData;
  
  const logId = uuidv4();
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  const newLog = {
    id: logId,
    user_id: user_id || null,
    type,
    message,
    details: details || null,
    level,
    timestamp
  };
  
  await insert('logs', Object.keys(newLog), Object.values(newLog));
  
  return await search('logs', 'id', logId);
}

/**
 * Get system health status
 */
async function getSystemHealth() {
  try {
    // Check database connectivity
    await executeQuery('SELECT 1');
    
    // Check if all required tables exist
    const tables = ['users', 'teams', 'workshops', 'instances', 'providers', 'sessions'];
    const tableChecks = await Promise.all(
      tables.map(async (table) => {
        try {
          await executeQuery(`SELECT COUNT(*) FROM ${table}`);
          return { table, status: 'OK' };
        } catch (error) {
          return { table, status: 'ERROR', error: error.message };
        }
      })
    );
    
    const failedTables = tableChecks.filter(check => check.status === 'ERROR');
    
    return {
      status: failedTables.length === 0 ? 'HEALTHY' : 'DEGRADED',
      database: 'OK',
      tables: tableChecks,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'UNHEALTHY',
      database: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get system configuration
 */
async function getSystemConfig() {
  // This would typically return system configuration
  // For now, return a basic structure
  return {
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: {
      type: 'mysql',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
    },
    features: {
      openid_connect: !!process.env.OPENID_ISSUER,
      vnc_console: true,
      instance_sync: true
    }
  };
}

/**
 * Get user activity summary
 */
async function getUserActivitySummary() {
  const activity = await executeQuery(`
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as log_count,
      COUNT(DISTINCT user_id) as active_users
    FROM logs 
    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
  `);
  
  return activity;
}

/**
 * Get instance usage statistics
 */
async function getInstanceUsageStats() {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_instances,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_instances,
      SUM(CASE WHEN status = 'SHUTOFF' THEN 1 ELSE 0 END) as stopped_instances,
      SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error_instances,
      COUNT(DISTINCT workshop_id) as workshops_with_instances
    FROM instances
  `);
  
  return stats[0];
}

/**
 * Get workshop usage statistics
 */
async function getWorkshopUsageStats() {
  const stats = await executeQuery(`
    SELECT 
      w.name as workshop_name,
      COUNT(i.id) as instance_count,
      COUNT(DISTINCT t.id) as team_count,
      COUNT(DISTINCT ut.user_id) as user_count
    FROM workshops w
    LEFT JOIN instances i ON w.id = i.workshop_id
    LEFT JOIN teams t ON w.id = t.workshop_id
    LEFT JOIN user_teams ut ON t.id = ut.team_id
    GROUP BY w.id, w.name
    ORDER BY instance_count DESC
  `);
  
  return stats;
}

/**
 * Get provider status
 */
async function getProviderStatus() {
  const providers = await searchAll('providers', [], [], { orderBy: 'name' });
  
  const statusPromises = providers.map(async (provider) => {
    try {
      const { testOpenStackConnection } = require('./openstack');
      const result = await testOpenStackConnection(provider);
      return {
        ...provider,
        connection_status: result.success ? 'ONLINE' : 'OFFLINE',
        last_check: new Date().toISOString()
      };
    } catch (error) {
      return {
        ...provider,
        connection_status: 'ERROR',
        last_check: new Date().toISOString(),
        error: error.message
      };
    }
  });
  
  return await Promise.all(statusPromises);
}

/**
 * Get session statistics
 */
async function getSessionStats() {
  const stats = await executeQuery(`
    SELECT 
      COUNT(*) as total_sessions,
      COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_sessions,
      COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_sessions,
      console_type,
      COUNT(*) as count
    FROM sessions
    GROUP BY console_type
  `);
  
  return stats;
}

/**
 * Clean up old logs
 */
async function cleanupOldLogs(daysToKeep = 30) {
  const result = await executeQuery(
    'DELETE FROM logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [daysToKeep]
  );
  
  return {
    message: `Cleaned up logs older than ${daysToKeep} days`,
    deleted_count: result.affectedRows || 0
  };
}

module.exports = {
  getAdminStats,
  getSystemLogs,
  createSystemLog,
  getSystemHealth,
  getSystemConfig,
  getUserActivitySummary,
  getInstanceUsageStats,
  getWorkshopUsageStats,
  getProviderStatus,
  getSessionStats,
  cleanupOldLogs
};
