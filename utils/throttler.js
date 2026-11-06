// modules/throttler.js

import { rateLimit } from 'express-rate-limit';
import { slowDown } from 'express-slow-down';
import { logger } from '#utils/logger';

/**
 * Create limiters option
 * @param {Object} options - Configuration options
 * @param {number} [options.windowMs=900000] - Time window (15 minutes)
 * @param {number} [options.limit=100] - Maximum requests per window
 * @param {number} [options.delayAfter=50] - Requests before delay starts
 * @param {number} [options.delayMs=500] - Delay in milliseconds
 */
const createLimiters = (options = {}) => {
  const config = {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    limit: 100,
    delayAfter: 50,
    delayMs: 500,
    ...options
  };

  // Clients choose their session and path, so neither can be part of the limit key.
  const keyGenerator = (req) => req.ip;

  // Create limiter instances once
  const speedLimiter = slowDown({
    windowMs: config.windowMs,
    delayAfter: config.delayAfter,
    delayMs: () => config.delayMs,
    keyGenerator
  });

  const rateLimiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    keyGenerator,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded: ${req.method} ${req.path} from ${req.ip}`);
      res.error('Too many requests', 429);
    }
  });

  return { speedLimiter, rateLimiter };
};

/**
 * Request throttling middleware
 */
const throttler = (options = {}) => {
  const { speedLimiter, rateLimiter } = createLimiters(options);

  return (req, res, next) => {
    // Skip static files and specific paths
    if (req.path.startsWith('/libraries/') ||
      req.path.match(/\.(js|css|html|jpg|png|ico)$/)) {
      return next();
    }

    // Apply limiters in sequence
    speedLimiter(req, res, () => {
      rateLimiter(req, res, next);
    });
  };
};

export default throttler;