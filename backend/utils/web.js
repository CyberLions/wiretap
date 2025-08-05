const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swaggerConfig');
const { serverConfig } = require('./config');
const WebSocket = require('ws');

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
  
  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Error:', err);
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
