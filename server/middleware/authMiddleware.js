const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Requires Authorization: Bearer <token>.
 * Verifies JWT, loads user, sets req.user (Mongoose document, password excluded).
 */
const protect = async (req, res, next) => {
  let token = null;

  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Check Authorization Bearer header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim() === '') {
    return res.status(500).json({ message: 'Server misconfiguration: JWT_SECRET missing' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }

  // Support admin token
  if (decoded.role === 'admin') {
    const adminId = decoded.id || decoded.userId;
    if (adminId && adminId !== '000000000000000000000000') {
      const query = User.findById(adminId);
      const user = typeof query?.select === 'function' ? await query.select('+tokenVersion') : await query;
      if (!user || decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
      }
      req.user = user;
    } else {
      req.user = {
        _id: '000000000000000000000000',
        name: 'System Admin',
        email: decoded.email,
        role: 'admin',
      };
    }
    req.admin = { email: decoded.email, role: 'admin' };
    return next();
  }

  const userId = decoded.id || decoded.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }

  try {
    const query = User.findById(userId);
    const user = typeof query?.select === 'function' ? await query.select('+tokenVersion') : await query;
    if (!user || decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('authMiddleware:', err);
    return res.status(401).json({ message: 'Not authorized' });
  }
};

const auditLogger = require('../utils/auditLogger');

/**
 * Authorize specific roles (e.g. 'admin', 'faculty').
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role || req.admin?.role;
    if (!userRole || !roles.includes(userRole)) {
      auditLogger.log({
        req,
        action: 'ROLE_AUTHORIZATION_DENIED',
        category: 'AUTHZ',
        severity: 'WARNING',
        outcome: 'BLOCKED',
        statusCode: 403,
        metadata: {
          requiredRoles: roles,
          userRole: userRole || 'anonymous',
          path: req.originalUrl || req.url,
        },
      });
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

/**
 * Protect middleware specifically for admin routes
 */
const adminProtect = async (req, res, next) => {
  return protect(req, res, () => {
    const role = req.user?.role || req.admin?.role;
    if (role !== 'admin') {
      auditLogger.log({
        req,
        action: 'ADMIN_ACCESS_DENIED',
        category: 'AUTHZ',
        severity: 'WARNING',
        outcome: 'BLOCKED',
        statusCode: 403,
        metadata: {
          attemptedRole: role || 'anonymous',
          path: req.originalUrl || req.url,
        },
      });
      return res.status(403).json({ message: 'Not authorized, admin only' });
    }
    next();
  });
};

/**
 * Attaches req.user when a valid session cookie/token is present.
 * Does not reject anonymous requests (for public item reads).
 */
const optionalProtect = async (req, res, next) => {
  let token = null;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim() === '') {
    return next();
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (decoded.role === 'admin') {
      req.admin = { email: decoded.email, role: 'admin' };
      req.user = {
        _id: '000000000000000000000000',
        name: 'System Admin',
        email: decoded.email,
        role: 'admin',
      };
      return next();
    }

    const targetId = decoded.id || decoded.userId;
    if (targetId && targetId !== '000000000000000000000000') {
      const query = User.findById(targetId);
      const user = typeof query?.select === 'function' ? await query.select('+tokenVersion') : await query;
      if (user && decoded.tokenVersion === user.tokenVersion) {
        req.user = user;
      }
    }
  } catch {
    // Invalid token: treat as anonymous for public reads
  }

  return next();
};

module.exports = {
  protect,
  optionalProtect,
  authorize,
  adminProtect,
  protectAdmin: adminProtect,
  requireVerifiedEmail: require('./requireVerifiedEmail'),
};
