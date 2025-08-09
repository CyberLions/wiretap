const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swaggerConfig');
const { serverConfig } = require('./config');
const WebSocket = require('ws');
const { insert } = require('./db');
const { v4: uuidv4 } = require('uuid');

// Import route modules
const authRoutes = require('../routes/auth');
const providerRoutes = require('../routes/providers');
const workshopRoutes = require('../routes/workshops');
const teamRoutes = require('../routes/teams');
const userRoutes = require('../routes/users');
const instanceRoutes = require('../routes/instances');
const vncRoutes = require('../routes/vnc');
const adminRoutes = require('../routes/admin');

function startServer(port = 3000) {
  const app = express();
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // CORS configuration
  app.use(cors(serverConfig.cors));
  
  // Request logging (console + DB)
  app.use((req, res, next) => {
    const startTimeMs = Date.now();
    const originalUrl = req.originalUrl || req.url;
    console.log(`${new Date().toISOString()} - ${req.method} ${originalUrl}`);

    res.on('finish', async () => {
      try {
        const durationMs = Date.now() - startTimeMs;
        const statusCode = res.statusCode;
        const userId = req.user?.id || null;
        const ipHeader = req.headers['x-forwarded-for'];
        const ipAddress = Array.isArray(ipHeader)
          ? ipHeader[0]
          : (ipHeader?.split(',')[0] || req.ip || req.connection?.remoteAddress || null);

        const redactBody = (body) => {
          if (!body || typeof body !== 'object') return body;
          const clone = { ...body };
          const redactKeys = ['password', 'token', 'authorization', 'api_key'];
          for (const key of redactKeys) {
            if (key in clone) clone[key] = '[REDACTED]';
          }
          return clone;
        };

        const details = JSON.stringify({
          method: req.method,
          path: originalUrl,
          status: statusCode,
          durationMs,
          userAgent: req.headers['user-agent'],
          query: req.query || {},
          body: redactBody(req.body),
        });

        const logRecord = {
          id: uuidv4(),
          user_id: userId,
          type: 'request',
          action: `${req.method} ${originalUrl} ${statusCode}`,
          details,
          ip_address: ipAddress,
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        };

        await insert('logs', Object.keys(logRecord), Object.values(logRecord));
      } catch (e) {
        // Keep non-blocking; already logged to console
      }
    });

    next();
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'Wiretap API'
    });
  });
  
  // API documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  
  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/providers', providerRoutes);
  app.use('/api/workshops', workshopRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/instances', instanceRoutes);
  app.use('/api/vnc', vncRoutes);
  app.use('/api/admin', adminRoutes);
  
  // Error handling middleware (also log to DB)
  app.use((err, req, res, next) => {
    console.error('Error:', err);

    (async () => {
      try {
        const userId = req?.user?.id || null;
        const ipHeader = req.headers?.['x-forwarded-for'];
        const ipAddress = Array.isArray(ipHeader)
          ? ipHeader[0]
          : (ipHeader?.split(',')[0] || req.ip || req.connection?.remoteAddress || null);
        const details = JSON.stringify({
          message: err.message,
          stack: err.stack,
          path: req?.originalUrl || req?.url,
          method: req?.method,
        });
        const logRecord = {
          id: uuidv4(),
          user_id: userId,
          type: 'error',
          action: `ERROR ${req?.method || ''} ${req?.originalUrl || req?.url || ''}`.trim(),
          details,
          ip_address: ipAddress,
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        };
        await insert('logs', Object.keys(logRecord), Object.values(logRecord));
      } catch (_) {}
    })();

    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal server error',
        status: err.status || 500
      }
    });
  });
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: {
        message: 'Route not found',
        status: 404
      }
    });
  });
  
  // Start HTTP server
  const server = app.listen(port, serverConfig.host, () => {
    console.log(`Wiretap API server running on http://${serverConfig.host}:${port}`);
    console.log(`API Documentation available at http://${serverConfig.host}:${port}/api-docs`);
  });
  
  // WebSocket server for VNC connections
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws/vnc'
  });
  
  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established for VNC');
    
    ws.on('message', (message) => {
      // Handle VNC WebSocket messages
      console.log('VNC WebSocket message received');
    });
    
    ws.on('close', () => {
      console.log('VNC WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('VNC WebSocket error:', error);
    });
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('HTTP server closed');
      wss.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
      });
    });
  });
  
  return server;
}

module.exports = { startServer };
