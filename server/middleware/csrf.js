const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_BOOTSTRAP_PATHS = new Set([
  '/api/auth/login',
  '/api/users/login',
  '/api/admin/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/verify-email',
]);

function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim().replace(/\/+$/, '') : null,
    ...(process.env.ADDITIONAL_ALLOWED_ORIGINS
      ? process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/+$/, ''))
      : []),
  ].filter(Boolean);

  const devOrigins = [
    (process.env.LOCAL_FRONTEND_URL_1 || 'http://localhost:5173').trim().replace(/\/+$/, ''),
    (process.env.LOCAL_FRONTEND_URL_2 || 'http://localhost:5174').trim().replace(/\/+$/, ''),
  ];

  return [
    ...configuredOrigins,
    ...(process.env.NODE_ENV !== 'production' ? devOrigins : []),
  ];
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res, token) {
  res.cookie('csrfToken', token, csrfCookieOptions());
}

function issueCsrfToken(res) {
  const csrfToken = createCsrfToken();
  setCsrfCookie(res, csrfToken);
  return csrfToken;
}

function clearCsrfCookie(res) {
  res.clearCookie('csrfToken', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

function extractRequestOrigin(req) {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.trim()) {
    return originHeader.trim().replace(/\/+$/, '');
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === 'string' && refererHeader.trim()) {
    try {
      return new URL(refererHeader.trim()).origin;
    } catch {
      return null;
    }
  }

  return null;
}

function tokensMatch(headerToken, cookieToken) {
  if (typeof headerToken !== 'string' || typeof cookieToken !== 'string') {
    return false;
  }

  const headerBuf = Buffer.from(headerToken);
  const cookieBuf = Buffer.from(cookieToken);
  if (headerBuf.length === 0 || headerBuf.length !== cookieBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(headerBuf, cookieBuf);
}

function logCsrfDenial(req, reason) {
  console.warn('[csrf] request denied', {
    method: req.method,
    route: req.originalUrl || req.url,
    ip: req.ip,
    reason,
  });
}

function isCsrfBootstrapPath(req) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return CSRF_BOOTSTRAP_PATHS.has(path);
}

function validateOriginAndCsrf(req, res, next) {
  const method = String(req.method || '').toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return next();
  }

  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = extractRequestOrigin(req);

  if (!requestOrigin) {
    if (process.env.NODE_ENV === 'production') {
      logCsrfDenial(req, 'missing_origin');
      return res.status(403).json({
        message: 'Access denied: Invalid or missing Origin',
      });
    }
  } else if (!allowedOrigins.includes(requestOrigin)) {
    logCsrfDenial(req, 'unapproved_origin');
    return res.status(403).json({
      message: 'Access denied: Invalid or missing Origin',
    });
  }

  // Login/register establish the session and issue the CSRF cookie.
  if (isCsrfBootstrapPath(req)) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies ? req.cookies.csrfToken : undefined;

  if (!headerToken || !cookieToken || !tokensMatch(headerToken, cookieToken)) {
    logCsrfDenial(req, 'csrf_token_mismatch');
    return res.status(403).json({
      message: 'Invalid or missing CSRF token',
    });
  }

  return next();
}

module.exports = {
  validateOriginAndCsrf,
  getAllowedOrigins,
  createCsrfToken,
  setCsrfCookie,
  issueCsrfToken,
  clearCsrfCookie,
};
