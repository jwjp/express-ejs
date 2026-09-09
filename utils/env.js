import { logger } from '#utils/logger';

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const parseList = (value, defaultValue = []) => {
  if (!value) {
    return defaultValue;
  }

  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const requiredInProduction = (name) => {
  if (process.env.NODE_ENV === 'production' && !process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
};

const validateCoreEnv = () => {
  requiredInProduction('SESSION_SECRET');
  requiredInProduction('DB_HOST');
  requiredInProduction('DB_USER');
  requiredInProduction('DB_DATABASE');

  if (!process.env.SESSION_SECRET) {
    logger.warn('SESSION_SECRET is not set. Using an insecure development-only fallback.');
  }
};

const getSessionSecret = () => {
  return process.env.SESSION_SECRET || 'development-session-secret-change-me';
};

export {
  getSessionSecret,
  parseList,
  requiredInProduction,
  toBoolean,
  validateCoreEnv
};
