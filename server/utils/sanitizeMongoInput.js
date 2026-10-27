/**
 * Comprehensive NoSQL Injection and Prototype Pollution Protection Utility.
 * Provides both sanitization (stripping) and strict validation (rejection).
 */

const FORBIDDEN_OPERATORS = new Set([
  '$where',
  '$function',
  '$expr',
  '$jsonSchema',
  '$out',
  '$merge',
  '$accumulator',
  '$gt',
  '$ne',
  '$regex',
  '$or',
  '$and',
  '$nor',
  '$not',
  '$elemMatch',
]);

const PROTOTYPE_POLLUTION_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

class NoSqlInjectionError extends Error {
  constructor(message, key, path = '') {
    super(message);
    this.name = 'NoSqlInjectionError';
    this.statusCode = 400;
    this.status = 400;
    this.rejectedKey = key;
    this.path = path;
  }
}

/**
 * Checks if a key starts with $ or matches any forbidden operator or prototype pollution key.
 */
function isForbiddenKey(key) {
  if (typeof key !== 'string') return false;
  if (key.startsWith('$')) return true;
  if (/\$[a-zA-Z]/.test(key)) return true;
  if (FORBIDDEN_OPERATORS.has(key)) return true;
  if (PROTOTYPE_POLLUTION_KEYS.has(key)) return true;
  if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) return true;
  return false;
}

/**
 * Recursively inspects data structures to find any forbidden keys.
 * Returns { key, path } on first violation, or null if clean.
 */
function findForbiddenKey(input, currentPath = '') {
  if (input === null || typeof input !== 'object') {
    return null;
  }

  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++) {
      const match = findForbiddenKey(input[i], `${currentPath}[${i}]`);
      if (match) return match;
    }
    return null;
  }

  if (input instanceof Date || input instanceof RegExp || Buffer.isBuffer(input)) {
    return null;
  }

  // Check prototype pollution key directly if present
  if (Object.prototype.hasOwnProperty.call(input, '__proto__')) {
    return { key: '__proto__', path: currentPath ? `${currentPath}.__proto__` : '__proto__' };
  }

  const keys = Object.getOwnPropertyNames(input);
  for (const key of keys) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;
    if (isForbiddenKey(key)) {
      return { key, path: keyPath };
    }
    const nested = findForbiddenKey(input[key], keyPath);
    if (nested) return nested;
  }

  return null;
}

/**
 * Mode 1: Sanitize (Strip)
 * Recursively strips keys starting with $ or matching forbidden operators / prototype keys.
 */
function sanitize(input) {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++) {
      input[i] = sanitize(input[i]);
    }
    return input;
  }

  if (input instanceof Date || input instanceof RegExp || Buffer.isBuffer(input)) {
    return input;
  }

  const keys = Object.getOwnPropertyNames(input);
  for (const key of keys) {
    if (isForbiddenKey(key)) {
      delete input[key];
    } else {
      input[key] = sanitize(input[key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, '__proto__')) {
    delete input.__proto__;
  }

  return input;
}

/**
 * Mode 2: ValidateStrict (Reject)
 * Recursively checks data and rejects if any forbidden operator or prototype pollution key is found.
 */
function validateStrict(input, options = {}) {
  const violation = findForbiddenKey(input);
  if (violation) {
    if (options.throw === false) {
      return { valid: false, ...violation };
    }
    throw new NoSqlInjectionError(
      `Invalid input: forbidden key or operator '${violation.key}' detected at ${violation.path || 'root'}`,
      violation.key,
      violation.path
    );
  }
  return { valid: true };
}

/**
 * Express middleware for request-level NoSQL injection protection.
 */
function mongoSanitizeMiddleware(options = { mode: 'validateStrict' }) {
  const mode = options.mode || 'validateStrict';

  return (req, res, next) => {
    const targets = ['body', 'query', 'params'];

    for (const target of targets) {
      const data = req[target];
      if (!data || typeof data !== 'object') continue;

      if (mode === 'validateStrict') {
        const violation = findForbiddenKey(data);
        if (violation) {
          // Log rejected injection attempts with non-sensitive metadata (Route, IP, rejected key)
          console.warn('[SECURITY] NoSQL injection attempt blocked:', {
            route: req.originalUrl || req.url,
            method: req.method,
            ip: req.ip,
            rejectedKey: violation.key,
          });

          return res.status(400).json({
            message: 'Invalid request input.',
          });
        }
      } else {
        sanitize(data);
      }
    }

    next();
  };
}

module.exports = {
  sanitize,
  validateStrict,
  findForbiddenKey,
  isForbiddenKey,
  mongoSanitizeMiddleware,
  NoSqlInjectionError,
  FORBIDDEN_OPERATORS,
  PROTOTYPE_POLLUTION_KEYS,
};
