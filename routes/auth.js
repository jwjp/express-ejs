// routes/auth.js

import express from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import validate from '#utils/validator';
import User from '#models/user';
import { logger } from '#utils/logger';
import throttler from '#utils/throttler';
import safeLocalPath from '#utils/safeRedirect';

const router = express.Router();

// Login validation rules
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
    .trim(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Registration validation rules
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
    .trim(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]/)
    .withMessage('Password must contain letters, numbers, and special characters')
];

// Password confirmation validation rule
const confirmPasswordValidation = [
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

/**
 * POST /auth/login - Process login form
 */
router.post('/login', validate(loginValidation), (req, res, next) => {
  const rememberMe = req.body?.rememberMe === 'true';

  if (req.isAuthenticated()) {
    return res.error('You are already logged in', 400);
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) {
      // Exceeded login attempt limit
      if (err.status === 429) {
        if (req.accepts('json')) {
          return res.error(err.message, err.status, {
            remainingTime: err.remainingTime
          });
        }
        return res.redirect(`/login?error=tooManyAttempts&remainingTime=${err.remainingTime}`);
      }

      // Authentication failed
      if (err.status === 401) {
        if (req.accepts('json')) {
          return res.error(err.message, err.status, {
            remainingAttempts: err.remainingAttempts
          });
        }
        return res.redirect(`/login?error=invalid&remainingAttempts=${err.remainingAttempts}`);
      }

      // Other errors
      logger.error('Login error:', err);
      return next(err);
    }

    // Log in the user
    req.logIn(user, (err) => {
      if (err) {
        logger.error('Error logging in user:', err);
        return next(err);
      }

      // Remember Me
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }

      // Handle API requests
      if (req.accepts('json')) {
        return res.success('Login successful', { user });
      }

      // Handle web requests - redirect to the home page or the originally requested URL
      const redirectTo = safeLocalPath(req.session.returnTo);
      delete req.session.returnTo;

      return res.redirect(redirectTo);
    });
  })(req, res, next);
});

/**
 * POST /auth/register - Process registration form
 */
router.post('/register', validate([...registerValidation, ...confirmPasswordValidation]), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if email already exists
    const existingUser = await User.findUserByEmail(email);
    if (existingUser) {
      return res.error('Email already in use', 400);
    }

    // Create the user
    const userId = await User.createUser({
      name,
      email,
      password,
      role: 'user'
    });

    res.success('Registration successful', { userId });
  } catch (error) {
    // Check for duplicate email error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.error('Email already in use', 400);
    }

    logger.error('Error registering user:', error);
    next(error);
  }
});

/**
 * GET /auth/logout - Log out the user
 */
router.get('/logout', throttler(), (req, res, next) => {
  if (req.isAuthenticated()) {
    req.logout((err) => {
      if (err) {
        logger.error('Error logging out:', err);
        return next(err);
      }

      res.redirect('/login');
    });
  } else {
    res.redirect('/');
  }
});

export default router;