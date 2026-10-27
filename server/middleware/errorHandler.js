/**
 * Centralized error handling middleware.
 * Catches errors passed via next(err), handles specific error types safely,
 * and ensures internal details/stack traces are never leaked in production.
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'csrf',
  'csrftoken',
  'refreshtoken',
];

/**
 * Safely sanitizes an object by redacting sensitive credentials and tokens.
 */
const sanitizeMetadata = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const isArr = Array.isArray(obj);
  const result = isArr ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof key === 'string' && SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeMetadata(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

const errorHandler = (err, req, res, next) => {
  // If headers have already been sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  let statusCode = err.status || err.statusCode || 500;
  let specificMessage = null;

  // 1. Multer file size errors (LIMIT_FILE_SIZE) -> 413
  if (err.code === 'LIMIT_FILE_SIZE' || (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE')) {
    statusCode = 413;
    specificMessage = 'File too large. Maximum size is 5MB.';
  }
  // Other Multer errors -> 400
  else if (err.name === 'MulterError') {
    statusCode = 400;
    specificMessage = isProduction ? 'Invalid request' : err.message;
  }
  // 2. Duplicate key errors (Mongo 11000) -> 400
  else if (
    err.code === 11000 ||
    err.code === '11000' ||
    (err.name === 'MongoServerError' && err.code === 11000)
  ) {
    statusCode = 400;
    specificMessage = 'Resource already exists.';
  }
  // 3. Mongoose validation errors / CastError / NoSQL injection error -> 400
  else if (err.name === 'ValidationError' || err.name === 'CastError' || err.name === 'NoSqlInjectionError') {
    statusCode = 400;
    specificMessage = 'Invalid request input.';
  }
  // 4. JSON syntax errors -> 400
  else if (
    (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) ||
    err.type === 'entity.parse.failed'
  ) {
    statusCode = 400;
    specificMessage = 'Malformed request body.';
  }
  // 5. CORS origin errors -> 403
  else if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    specificMessage = isProduction ? 'Access denied' : 'Access denied by CORS policy: Origin not allowed';
  }

  // Determine response message based on environment
  let responseMessage;
  if (isProduction) {
    if (specificMessage) {
      responseMessage = specificMessage;
    } else if (statusCode === 400) {
      responseMessage = 'Invalid request';
    } else if (statusCode === 401) {
      responseMessage = 'Not authorized';
    } else if (statusCode === 403) {
      responseMessage = 'Access denied';
    } else if (statusCode === 404) {
      responseMessage = 'Resource not found';
    } else if (statusCode === 413) {
      responseMessage = 'File too large. Maximum size is 5MB.';
    } else {
      statusCode = 500;
      responseMessage = 'Internal server error';
    }
  } else {
    // In development / testing: aid debugging
    responseMessage = specificMessage || err.message || 'Internal server error';
  }

  // Safe server-side error logging: never logging passwords, JWTs, or tokens
  const route = req?.originalUrl || req?.url || 'unknown';
  const method = req?.method || 'unknown';
  const safeLogData = {
    method,
    route,
    statusCode,
    ip: req?.ip,
    errorName: err?.name,
    errorCode: err?.code,
  };

  if (req?.params && Object.keys(req.params).length > 0) {
    safeLogData.params = sanitizeMetadata(req.params);
  }
  if (req?.query && Object.keys(req.query).length > 0) {
    safeLogData.query = sanitizeMetadata(req.query);
  }

  console.error(`[ERROR] ${method} ${route}:`, safeLogData);
  if (!isProduction && err?.stack) {
    console.error(err.stack);
  }

  // Return clean JSON response
  if (isProduction) {
    return res.status(statusCode).json({
      message: responseMessage,
    });
  }

  return res.status(statusCode).json({
    message: responseMessage,
    ...(err?.message && err.message !== responseMessage ? { error: err.message } : {}),
    ...(err?.stack ? { stack: err.stack } : {}),
  });
};

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
