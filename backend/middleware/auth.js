const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../utils/config');
const { search, searchAll } = require('../utils/db');

/**
 * Middleware to authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, jwtConfig.secret);
    
    // Get user from database
    const user = await search('users', 'id', decoded.userId);
    
    if (!user || !user.enabled) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }
    
    // Add user to request object
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware to require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

/**
 * Middleware to check if user can access workshop
 */
const canAccessWorkshop = async (req, res, next) => {
  try {
    const { id: workshopId } = req.params;
    const userId = req.user.id;
    
    // Admins can access all workshops
    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    // Check if user is in any team in this workshop
    const userTeams = await searchAll('user_teams', ['user_id'], [userId]);
    
    if (userTeams.length === 0) {
      return res.status(403).json({ error: 'Access denied to workshop' });
    }
    
    // Check if any of user's teams belong to this workshop
    const teamIds = userTeams.map(ut => ut.team_id);
    const teams = await searchAll('teams', ['id'], teamIds);
    
    const hasAccess = teams.some(team => team.workshop_id === workshopId);
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to workshop' });
    }
    
    next();
  } catch (error) {
    console.error('Workshop access check error:', error);
    res.status(500).json({ error: 'Failed to verify workshop access' });
  }
};

/**
 * Middleware to check if user can access instance
 */
const canAccessInstance = async (req, res, next) => {
  try {
    const { instanceId, id } = req.params;
    const instanceIdToUse = instanceId || id;
    const userId = req.user.id;
    
    // Admins can access all instances
    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    // Get instance
    const instance = await search('instances', 'id', instanceIdToUse);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    // Check if instance is assigned to user or user's team
    if (instance.user_id === userId) {
      return next();
    }
    
    if (instance.team_id) {
      // Check if user is in the team
      const userTeam = await searchAll('user_teams', ['user_id', 'team_id'], [userId, instance.team_id]);
      
      if (userTeam.length > 0) {
        return next();
      }
    }
    
    return res.status(403).json({ error: 'Access denied to instance' });
  } catch (error) {
    console.error('Instance access check error:', error);
    res.status(500).json({ error: 'Failed to verify instance access' });
  }
};

/**
 * Middleware to check if user can access team
 */
const canAccessTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    
    // Admins can access all teams
    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    // Check if user is in this team
    const userTeam = await searchAll('user_teams', ['user_id', 'team_id'], [userId, teamId]);
    
    if (userTeam.length === 0) {
      return res.status(403).json({ error: 'Access denied to team' });
    }
    
    next();
  } catch (error) {
    console.error('Team access check error:', error);
    res.status(500).json({ error: 'Failed to verify team access' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  canAccessWorkshop,
  canAccessInstance,
  canAccessTeam
}; 