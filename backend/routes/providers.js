const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { search, searchAll, insert, update, deleteFrom } = require('../utils/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * /api/providers:
 *   get:
 *     summary: Get all providers
 *     tags: [Providers]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of providers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   auth_url:
 *                     type: string
 *                   identity_version:
 *                     type: string
 *                     example: "v3"
 *                   enabled:
 *                     type: boolean
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const providers = await searchAll('providers', [], [], { orderBy: 'name' });
    
    // Remove sensitive information
    const sanitizedProviders = providers.map(provider => {
      const { password, ...sanitized } = provider;
      return sanitized;
    });
    
    res.json(sanitizedProviders);
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

/**
 * @swagger
 * /api/providers/{id}:
 *   get:
 *     summary: Get provider by ID
 *     tags: [Providers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider details
 *       404:
 *         description: Provider not found
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const provider = await search('providers', 'id', id);
    
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    // Remove sensitive information
    const { password, ...sanitized } = provider;
    
    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching provider:', error);
    res.status(500).json({ error: 'Failed to fetch provider' });
  }
});

/**
 * @swagger
 * /api/providers:
 *   post:
 *     summary: Create new provider
 *     tags: [Providers]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - auth_url
 *               - username
 *               - password
 *               - project_name
 *               - region_name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Production OpenStack"
 *               description:
 *                 type: string
 *                 example: "Production OpenStack cluster"
 *               auth_url:
 *                 type: string
 *                 description: "Base URL for OpenStack Keystone (without version suffix)"
 *                 example: "https://openstack.example.com:5000"
 *               identity_version:
 *                 type: string
 *                 description: "OpenStack Identity API version"
 *                 example: "v3"
 *                 default: "v3"
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               project_name:
 *                 type: string
 *                 example: "admin"
 *               region_name:
 *                 type: string
 *                 example: "RegionOne"
 *               domain_name:
 *                 type: string
 *                 example: "Default"
 *               domain_id:
 *                 type: string
 *                 example: "default"
 *     responses:
 *       201:
 *         description: Provider created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      auth_url,
      identity_version,
      username,
      password,
      project_name,
      region_name,
      domain_name,
      domain_id
    } = req.body;
    
    if (!name || !auth_url || !username || !password || !project_name || !region_name) {
      return res.status(400).json({ 
        error: 'Name, auth_url, username, password, project_name, and region_name are required' 
      });
    }
    
    // Check if provider name already exists
    const existingProvider = await search('providers', 'name', name);
    if (existingProvider) {
      return res.status(409).json({ error: 'Provider with this name already exists' });
    }
    
    const providerId = uuidv4();
    const providerData = {
      id: providerId,
      name,
      description: description || '',
      auth_url,
      identity_version: identity_version || 'v3',
      username,
      password,
      project_name,
      region_name,
      domain_name: domain_name || null,
      domain_id: domain_id || null,
      enabled: true
    };
    
    await insert('providers', Object.keys(providerData), Object.values(providerData));
    
    const newProvider = await search('providers', 'id', providerId);
    const { password: _, ...sanitized } = newProvider;
    
    res.status(201).json(sanitized);
  } catch (error) {
    console.error('Error creating provider:', error);
    res.status(500).json({ error: 'Failed to create provider' });
  }
});

/**
 * @swagger
 * /api/providers/{id}:
 *   put:
 *     summary: Update provider
 *     tags: [Providers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               auth_url:
 *                 type: string
 *                 description: "Base URL for OpenStack Keystone (without version suffix)"
 *               identity_version:
 *                 type: string
 *                 description: "OpenStack Identity API version"
 *                 example: "v3"
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               project_name:
 *                 type: string
 *               region_name:
 *                 type: string
 *               domain_name:
 *                 type: string
 *               domain_id:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Provider updated successfully
 *       404:
 *         description: Provider not found
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const provider = await search('providers', 'id', id);
    
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    const updateFields = [
      'name', 'description', 'auth_url', 'identity_version', 'username', 'password',
      'project_name', 'region_name', 'domain_name', 'domain_id', 'enabled'
    ];
    
    for (const field of updateFields) {
      if (req.body[field] !== undefined) {
        await update('providers', 'id', id, field, req.body[field]);
      }
    }
    
    const updatedProvider = await search('providers', 'id', id);
    const { password, ...sanitized } = updatedProvider;
    
    res.json(sanitized);
  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

/**
 * @swagger
 * /api/providers/{id}:
 *   delete:
 *     summary: Delete provider
 *     tags: [Providers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider deleted successfully
 *       404:
 *         description: Provider not found
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const provider = await search('providers', 'id', id);
    
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    // Check if provider has associated workshops
    const workshops = await searchAll('workshops', ['provider_id'], [id]);
    if (workshops.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete provider with associated workshops' 
      });
    }
    
    await deleteFrom('providers', ['id'], [id]);
    
    res.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    console.error('Error deleting provider:', error);
    res.status(500).json({ error: 'Failed to delete provider' });
  }
});

/**
 * @swagger
 * /api/providers/{id}/test:
 *   post:
 *     summary: Test provider connection
 *     tags: [Providers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection test result
 *       404:
 *         description: Provider not found
 */
router.post('/:id/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const provider = await search('providers', 'id', id);
    
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    // Test OpenStack connection
    const { testOpenStackConnection } = require('../managers/openstack');
    const result = await testOpenStackConnection(provider);
    
    res.json(result);
  } catch (error) {
    console.error('Error testing provider connection:', error);
    res.status(500).json({ error: 'Failed to test provider connection' });
  }
});

/**
 * @swagger
 * /api/providers/{id}/ingest:
 *   post:
 *     summary: Ingest VMs from provider
 *     tags: [Providers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team_id
 *             properties:
 *               team_id:
 *                 type: string
 *                 example: "uuid-of-team"
 *     responses:
 *       200:
 *         description: VMs ingested successfully
 *       404:
 *         description: Provider not found
 */
router.post('/:id/ingest', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { team_id } = req.body;
    
    const provider = await search('providers', 'id', id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    
    if (team_id) {
      const team = await search('teams', 'id', team_id);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
    }
    
    // Ingest VMs from OpenStack
    const { ingestVMsFromProvider } = require('../managers/openstack');
    const result = await ingestVMsFromProvider(provider, team_id);
    
    res.json({
      message: 'VMs ingested successfully',
      ingested_count: result.ingested_count,
      instances: result.instances
    });
  } catch (error) {
    console.error('Error ingesting VMs:', error);
    res.status(500).json({ error: 'Failed to ingest VMs' });
  }
});

module.exports = router; 