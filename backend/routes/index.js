const express = require('express');
const router = express.Router();

// Import route modules
const androidRoutes = require('./android/index.js');
const downloadsRoutes = require('./downloads/index.js');
const usersRoutes = require('./users/index.js');
const uploadsRoutes = require('./uploads/index.js');
const sharesRoutes = require('./shares/index.js');
const reverseSharesRoutes = require('./reverse-shares/index.js');
const apiKeysRoutes = require('./api-keys/index.js');
const releasesRoutes = require('./releases/index.js');

const garbageCollectionRoutes = require('./garbage-collection/index.js');

// Mount routes
router.use(`/users`, usersRoutes);
router.use(`/uploads`, uploadsRoutes);
router.use(`/downloads`, downloadsRoutes);
router.use(`/android`, androidRoutes);
router.use(`/shares`, sharesRoutes);
router.use(`/reverse-shares`, reverseSharesRoutes);
router.use(`/api-keys`, apiKeysRoutes);
router.use(`/releases`, releasesRoutes);

router.use(`/garbage-collection`, garbageCollectionRoutes);

module.exports = router;
