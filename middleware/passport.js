// middleware/passport.js

import passport from 'passport';
import passportLocal from 'passport-local';
const LocalStrategy = passportLocal.Strategy;
import User from '#models/user';
import { logger } from '#utils/logger';

// Map to store login attempts
const loginAttempts = new Map();

// Cleanup expired login attempts
const cleanupExpiredAttempts = (windowMs) => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > windowMs) {
      loginAttempts.delete(key);
    }
  }
};

/**
 * Configure local strategy for use by Passport
 */
const configureLocalStrategy = ({
    maxAttempts = 5,
    windowMs = 30 * 1000,
} = {}) => {
  return new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    },
    async (req, email, password, done) => {
      try {
        const ip = req.ip ||
          req.headers['x-forwarded-for'] ||
          req.headers['x-real-ip'] ||
          req.connection.remoteAddress ||
          req.socket.remoteAddress;

        const attemptsKey = `${ip}-${String(email).toLowerCase()}`;

        // Clean up expired login attempts
        cleanupExpiredAttempts(windowMs);

        const attempts = loginAttempts.get(attemptsKey) || {count: 0, lastAttempt: 0};
        const now = Date.now();

        if (now - attempts.lastAttempt > windowMs) {
          attempts.count = 0;
        }

        if (attempts.count >= maxAttempts) {
          const err = new Error('Too many login attempts. Please try again later.');
          err.status = 429;
          err.remainingTime = Math.ceil((attempts.lastAttempt + windowMs - now) / 1000);
          return done(err);
        }

        attempts.count += 1;
        attempts.lastAttempt = now;
        loginAttempts.set(attemptsKey, attempts);

        // Find user by email
        const user = await User.findUserByEmail(email);

        // If user not found
        if (!user) {
          const err = new Error('Incorrect email or password');
          err.status = 401;
          err.remainingAttempts = maxAttempts - attempts.count;
          return done(err);
        }

        // Verify password
        const isValid = await User.verifyPassword(password, user.password);

        // If password is invalid
        if (!isValid) {
          const err = new Error('Incorrect email or password');
          err.status = 401;
          err.remainingAttempts = maxAttempts - attempts.count;
          return done(err);
        }

        loginAttempts.delete(attemptsKey);

        // Update last login time
        await User.updateUserLastLogin(user.id);

        // Return user without password
        const {password: _, ...userWithoutPassword} = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        logger.error('Error during authentication:', error);
        return done(error);
      }
    }
  );
};

/**
 * Configure Passport.js local authentication strategy
 */
const configurePassport = () => {
  // Configure local strategy for use by Passport
  passport.use(configureLocalStrategy());

  // Serialize user to the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      logger.error('Error deserializing user:', error);
      done(error);
    }
  });

  return (app) => {
    app.use(passport.initialize());
    app.use(passport.session());
    logger.info('Passport authentication configured successfully');
    return app;
  };

};

export default configurePassport;
