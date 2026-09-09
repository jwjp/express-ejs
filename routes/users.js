// routes/users.js

import express from 'express';
import User from '#models/user';
import { normalizePermissions, role, permission } from '#utils/authorizer';
import { logger } from '#utils/logger';

const router = express.Router();

/**
 * GET /users - Get all users (admin only)
 */
router.get('/', role('admin'), permission('read:users'), async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const offset = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.getAllUsers({ limit, offset }),
      User.getUserCount()
    ]);

    res.success('Users retrieved successfully', {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error retrieving users:', error);
    next(error);
  }
});

/**
 * GET /users/:id - Get user by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId < 1) {
      return res.error('Invalid user ID', 400);
    }

    if (!req.user) {
      return res.error('Unauthorized', 401);
    }

    const permissions = normalizePermissions(req.user.permissions);
    const canReadUsers = req.user.role === 'admin' || permissions.includes('read:users');

    // Only allow users to view their own profile unless they have elevated access.
    if (!canReadUsers && req.user.id !== userId) {
      return res.error('Forbidden: You do not have permission to view this user', 403);
    }

    const user = await User.findUserById(userId);

    if (!user) {
      return res.error('User not found', 404);
    }

    res.success('User retrieved successfully', user);
  } catch (error) {
    logger.error('Error retrieving user:', error);
    next(error);
  }
});

export default router;
