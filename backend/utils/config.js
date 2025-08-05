const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'wiretap',
  password: process.env.DB_PASSWORD || 'wiretap123',
  database: process.env.DB_NAME || 'wiretap'
};

// OpenID Connect configuration
const openidConfig = {
  issuer: process.env.OPENID_ISSUER || 'https://authentik.example.com',
  clientId: process.env.OPENID_CLIENT_ID || 'wiretap',
  clientSecret: process.env.OPENID_CLIENT_SECRET || 'your-client-secret',
  redirectUri: process.env.OPENID_REDIRECT_URI || 'http://localhost:3000/api/auth/openid/callback',
  scope: process.env.OPENID_SCOPE || 'openid profile email groups',
  // Comma-separated list of OpenID groups that should be granted admin privileges
  adminGroups: process.env.OPENID_ADMIN_GROUPS?.split(',') || ['tech-team']
};

// JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-this-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

// OpenStack configuration
const openstackConfig = {
  defaultRegion: process.env.OPENSTACK_DEFAULT_REGION || 'RegionOne',
  connectionTimeout: parseInt(process.env.OPENSTACK_TIMEOUT) || 30000,
  maxRetries: parseInt(process.env.OPENSTACK_MAX_RETRIES) || 3
};

// VNC configuration
const vncConfig = {
  wsPath: process.env.VNC_WS_PATH || '/vnc',
  proxyTimeout: parseInt(process.env.VNC_PROXY_TIMEOUT) || 30000,
  sessionTimeout: parseInt(process.env.VNC_SESSION_TIMEOUT) || 3600000 // 1 hour
};

// Server configuration
const serverConfig = {
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5010',
    credentials: true
  }
};

// File upload configuration
const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'application/pdf'],
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../uploads')
};

// Logging configuration
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'combined'
};

// Validation function
function validateConfig() {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_USER', 
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
    'OPENID_ISSUER',
    'OPENID_CLIENT_ID',
    'OPENID_CLIENT_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('Warning: Missing environment variables:', missingVars.join(', '));
    console.warn('Using default values. This is not recommended for production.');
  }

  // Validate database connection
  if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
    throw new Error('Database configuration is incomplete');
  }

  // Validate OpenID configuration
  if (!openidConfig.issuer || !openidConfig.clientId || !openidConfig.clientSecret) {
    console.warn('Warning: OpenID Connect configuration is incomplete. SSO will not work.');
  }
  
  // Log admin groups configuration
  console.log(`OpenID Admin Groups: ${openidConfig.adminGroups.join(', ')}`);

  // Validate JWT secret
  if (jwtConfig.secret === 'your-jwt-secret-key-change-this-in-production') {
    console.warn('Warning: Using default JWT secret. Change this in production.');
  }

  console.log('Configuration validation completed');
}

module.exports = {
  dbConfig,
  openidConfig,
  jwtConfig,
  openstackConfig,
  vncConfig,
  serverConfig,
  uploadConfig,
  logConfig,
  validateConfig
}; 