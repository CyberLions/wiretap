// index.js
require('dotenv').config();
const { validateConfig } = require('./utils/config');
const { dbInitialization } = require('./utils/db');

(async () => {
  try {
    // 0. Validate environment configuration
    validateConfig();
    console.log('Environment configuration validated successfully');

    // 1. Wait for database initialization
    await dbInitialization;
    console.log('Database connection established and tables verified');

    // 2. Start web server
    console.log("Initiating Wiretap Server");
    
    const { startServer } = require('./utils/web');
    const server = startServer(process.env.PORT || 3000);
    
    // 3. Set up scheduled tasks
    console.log("Setting up scheduled tasks...");
    
    // Schedule instance status updates every 5 minutes
    const scheduleInstanceUpdates = () => {
      const { updateInstanceStatuses } = require('./managers/openstack');
      
      setInterval(async () => {
        try {
          console.log('Running scheduled instance status updates...');
          await updateInstanceStatuses();
        } catch (error) {
          console.error('Error in scheduled instance updates:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes
    };
    
    // Schedule session cleanup every hour
    const scheduleSessionCleanup = () => {
      const { cleanupExpiredSessions } = require('./managers/sessions');
      
      setInterval(async () => {
        try {
          console.log('Running scheduled session cleanup...');
          await cleanupExpiredSessions();
        } catch (error) {
          console.error('Error in scheduled session cleanup:', error);
        }
      }, 60 * 60 * 1000); // 1 hour
    };
    
    // Start scheduled tasks
    scheduleInstanceUpdates();
    scheduleSessionCleanup();
    
    console.log("Scheduled tasks configured successfully");
    
  } catch (err) {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
})();
