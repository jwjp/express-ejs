// middleware/authorization.js

import { logger } from '#utils/logger';

const normalizePermissions = (permissions) => {
  if (!permissions) {
    return [];
  }

  if (Array.isArray(permissions)) {
    return permissions;
  }

  if (typeof permissions !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(permissions);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    logger.warn('Invalid permissions JSON found on user object');
    return [];
  }
};

/**
 * Check if user has required role
 * @param {string|string[]} roles - Required role(s)
 * @returns {function} Middleware function
 */
const role = (roles) => {
  return (req, res, next) => {
    // Skip in development mode
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    // Check if user is authenticated
    if (!req.user) {
      logger.warn('Authorization failed: No user found');

      // Determine response format based on Accept header
      if (req.accepts('json')) {
        return res.error('Unauthorized', 401);
      }

      return res.redirect('/login?error=unauthorized');
    }

    // Convert roles to array if it's a string
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    // Check if user has any of the required roles
    if (requiredRoles.includes(req.user.role)) {
      return next();
    }

    // Log unauthorized access attempt
    logger.warn(`Authorization failed: User ${req.user.id} with role ${req.user.role} attempted to access resource requiring ${requiredRoles.join(', ')}`);

    // Determine response format based on Accept header
    if (req.accepts('json')) {
      return res.error('Forbidden: Insufficient permissions', 403);
    }

    // Handle web requests
    return res.render('error', {
      message: 'Forbidden: Insufficient permissions',
      error: { status: 403 }
    });
  };
};

/**
 * Check if user has required permission
 * @param {string|string[]} permissions - Required permission(s)
 * @returns {function} Middleware function
 */
const permission = (permissions) => {
  return (req, res, next) => {
    // Skip in development mode
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    // Check if user is authenticated
    if (!req.user) {
      logger.warn('Authorization failed: No user found');

      // Determine response format based on Accept header
      if (req.accepts('json')) {
        return res.error('Unauthorized', 401);
      }

      return res.redirect('/login?error=unauthorized');
    }

    // Admin role has all permissions
    // if (req.user.role === 'admin') {
    //     return next();
    // }

    // Convert permissions to array if it's a string
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    // Parse user permissions from JSON if they exist
    const userPermissions = normalizePermissions(req.user.permissions);

    // Check if user has any of the required permissions
    if (requiredPermissions.some(permission => userPermissions.includes(permission))) {
      return next();
    }

    // Log unauthorized access attempt
    logger.warn(`Authorization failed: User ${req.user.id} attempted to access resource requiring permissions ${requiredPermissions.join(', ')}`);

    // Determine response format based on Accept header
    if (req.accepts('json')) {
      return res.error('Forbidden: Insufficient permissions', 403);
    }

    // Handle web requests
    return res.render('error', {
      message: 'Forbidden: Insufficient permissions',
      error: { status: 403 }
    });
  };
};

export { normalizePermissions, role, permission }
