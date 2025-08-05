const mysql = require('mysql2');
const { initializeTables } = require('./db-init.js');
const { dbConfig } = require('./config.js');

// Add MySQL 8+ specific configuration
const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000, // 10-second connection timeout
  authPlugins: {
    mysql_clear_password: () => () => Buffer.from(dbConfig.password + '\0')
  }
});

pool.on('error', err => {
  console.error('Database connection pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.warn('Connection lost. Pool will auto-reconnect.');
  }
});

// Connection initialization with retries
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

async function initializeDatabase() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const connection = await pool.promise().getConnection();
      console.log('Connected to database.');
      await initializeTables(connection);
      connection.release();
      return true;
    } catch (err) {
      console.error(`Database initialization attempt ${attempt} failed:`, err.message);
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  throw new Error('Failed to initialize database after maximum retries');
}

// Export the initialization promise
const dbInitialization = initializeDatabase();

// Safe identifier wrapper
const escapeId = (id) => {
    if (typeof id !== 'string') {
      throw new Error(`Invalid identifier: ${JSON.stringify(id)}`);
    }
    return `\`${id.replace(/`/g, '')}\``;
  };
  

// Execute raw query with parameters
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.promise().query(query, params);
    return results;
  } catch (err) {
    console.error('Query Error:', err);
    throw err;
  }
};

// Insert row into table
const insert = async (table, fields, values) => {
  if (!Array.isArray(fields) || !Array.isArray(values) || fields.length !== values.length) {
    return { result: 'error', type: 'Invalid input: field/value mismatch' };
  }

  const fieldList = fields.map(escapeId).join(', ');
  const placeholders = fields.map(() => '?').join(', ');
  const query = `INSERT INTO ${escapeId(table)} (${fieldList}) VALUES (${placeholders})`;

  try {
    const result = await executeQuery(query, values);
    return { result: 'success', id: result.insertId };
  } catch (error) {
    return { result: 'error', type: error.message };
  }
};

// Search for one row
const search = async (table, field, value) => {
  const query = `SELECT * FROM ${escapeId(table)} WHERE ${escapeId(field)} = ? LIMIT 1`;
  try {
    const results = await executeQuery(query, [value]);
    return results[0] || null;
  } catch (error) {
    return { result: 'error', type: error.message };
  }
};

// Search multiple rows by conditions
const searchAll = async (table, fields = [], values = [], options = {}) => {
  if (!Array.isArray(fields) || !Array.isArray(values) || fields.length !== values.length) {
    throw new Error('Invalid fields/values: must be arrays of equal length');
  }

  let query;
  if (fields.length === 0) {
    // If no conditions, return all records
    query = `SELECT * FROM ${escapeId(table)}`;
  } else {
    const conditions = fields.map(f => `${escapeId(f)} = ?`).join(' AND ');
    query = `SELECT * FROM ${escapeId(table)} WHERE ${conditions}`;
  }

  // Add ORDER BY if specified
  if (options.orderBy) {
    // Check if orderBy already contains direction
    if (options.orderBy.toUpperCase().includes(' DESC') || options.orderBy.toUpperCase().includes(' ASC')) {
      // Split the orderBy string to separate column and direction
      const parts = options.orderBy.trim().split(/\s+/);
      const column = parts[0];
      const direction = parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${escapeId(column)} ${direction}`;
    } else {
      // Use the default direction
      const direction = options.orderDirection === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${escapeId(options.orderBy)} ${direction}`;
    }
  }

  try {
    return await executeQuery(query, values);
  } catch (error) {
    console.error('SearchAll Error:', error);
    return [];
  }
};

// Update one row
const update = async (table, fieldToUpdate, newValue, whereFields, whereValues) => {
    if (!Array.isArray(whereFields)) {
      // Single-field update
      const query = `UPDATE ${escapeId(table)} SET ${escapeId(fieldToUpdate)} = ? WHERE ${escapeId(whereFields)} = ?`;
      try {
        await executeQuery(query, [newValue, whereValues]);
        return { result: 'success' };
      } catch (error) {
        return { result: 'error', type: error.message };
      }
    }
  
    const conditions = whereFields.map(f =>
      f.includes('?') || f.includes(' ') ? f : `${escapeId(f)} = ?`
    ).join(' AND ');
  
    const query = `UPDATE ${escapeId(table)} SET ${escapeId(fieldToUpdate)} = ? WHERE ${conditions}`;
  
    try {
      await executeQuery(query, [newValue, ...whereValues]);
      return { result: 'success' };
    } catch (error) {
      return { result: 'error', type: error.message };
    }
};
  

// Check if record exists
const searchExists = async (table, field, value) => {
  const query = `SELECT 1 FROM ${escapeId(table)} WHERE ${escapeId(field)} = ? LIMIT 1`;
  try {
    const results = await executeQuery(query, [value]);
    return results.length > 0;
  } catch (error) {
    console.error('Exists Error:', error);
    return false;
  }
};

// Delete rows
const deleteFrom = async (table, fields, values) => {
  if (!Array.isArray(fields) || !Array.isArray(values) || fields.length !== values.length) {
    throw new Error('Invalid fields/values for deleteFrom');
  }

  const whereClause = fields.map(f => `${escapeId(f)} = ?`).join(' AND ');
  const query = `DELETE FROM ${escapeId(table)} WHERE ${whereClause}`;

  try {
    await executeQuery(query, values);
    return { result: 'success' };
  } catch (error) {
    return { result: 'error', type: error.message };
  }
};

module.exports = {
  insert,
  search,
  searchAll,
  update,
  searchExists,
  deleteFrom,
  executeQuery,
  dbInitialization 
};