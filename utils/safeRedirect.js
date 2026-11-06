// utils/safeRedirect.js

/**
 * Returns a path on this site, or the fallback for anything a browser could
 * resolve to another origin.
 */
const safeLocalPath = (value, fallback = '/') => {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return fallback;
  }

  // Browsers read a leading "//" or "/\" as a scheme-relative URL and ignore
  // tabs and newlines while parsing.
  if (value.startsWith('//') || value.startsWith('/\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }

  return value;
};

export default safeLocalPath;
