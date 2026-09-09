// middleware/gatekeeper.js

import { logger } from '#utils/logger';
import { parseList } from '#utils/env';

/**
 * A middleware function that serves as a security gatekeeper to control access to routes.
 */
const gatekeeper = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // public path
  const publicPaths = parseList(process.env.PUBLIC_PATHS, [
    '/',
    '/examples',
    '/login',
    '/auth/login',
    '/auth/logout',
    '/auth/register',
    '/stylesheets/',
    '/fonts/',
    '/images/',
    '/javascripts/'
  ]);

  // url
  const urlWithoutQuery = req.path.split('?')[0];

  // already login
  if (urlWithoutQuery === '/login' && req.isAuthenticated()) {
    return res.redirect(`/`);
  }

  // ip
  const ip = req.ip ||
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress;

  // allowed ip
  const allowedIps = parseList(process.env.ALLOWED_IPS, ['*']);

  // pass
  const isPublicPath = publicPaths.some(publicPath =>
    urlWithoutQuery === '' ||
    urlWithoutQuery === publicPath ||
    (publicPath !== '/' && urlWithoutQuery.startsWith(publicPath))
  );
  const isAllowedIp = allowedIps.includes('*') || allowedIps.includes(ip);

  if (isPublicPath && isAllowedIp) {
    return next();
  }

  // check session
  if (!req.isAuthenticated()) {
    logger.warn('No authentication information.');

    // response text
    if (req.accepts('json')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication information.'
      });
    }

    // Store the requested URL for redirection after login
    req.session.returnTo = req.originalUrl;

    // redirect
    return res.redirect(`/login?error=unauthorized`);
  }

  next();
};

export default gatekeeper;
