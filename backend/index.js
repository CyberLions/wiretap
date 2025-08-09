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

      // Run a sync once at startup
      (async () => {
        try {
          console.log('Running initial instance status sync...');
          await updateInstanceStatuses();
          console.log('Initial instance status sync completed');
        } catch (error) {
          console.error('Error in initial instance sync:', error);
        }
      })();
      
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
    
    // Schedule log cleanup every day at 2 AM
    const scheduleLogCleanup = () => {
      const { cleanupOldLogs } = require('./managers/admin');
      
      // Calculate time until next 2 AM
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setHours(2, 0, 0, 0);
      
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      const timeUntilNextRun = nextRun.getTime() - now.getTime();
      
      // Run cleanup at next 2 AM
      setTimeout(async () => {
        try {
          console.log('Running scheduled log cleanup...');
          await cleanupOldLogs(7); // Keep logs for 7 days
          console.log('Scheduled log cleanup completed');
        } catch (error) {
          console.error('Error in scheduled log cleanup:', error);
        }
        
        // Schedule next run every 24 hours
        setInterval(async () => {
          try {
            console.log('Running scheduled log cleanup...');
            await cleanupOldLogs(7); // Keep logs for 7 days
            console.log('Scheduled log cleanup completed');
          } catch (error) {
            console.error('Error in scheduled log cleanup:', error);
          }
        }, 24 * 60 * 60 * 1000); // 24 hours
      }, timeUntilNextRun);
    };
    
    // Start scheduled tasks
    scheduleInstanceUpdates();
    scheduleSessionCleanup();
    scheduleLogCleanup();

    // Initialize lockout scheduler
    const { initializeLockoutScheduler } = require('./managers/lockoutScheduler');
    await initializeLockoutScheduler();
    
    console.log("Scheduled tasks configured successfully");
    
  } catch (err) {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
})();
