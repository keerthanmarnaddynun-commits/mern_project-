const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protectAdmin = async (req, res, next) => {
  let token = null;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Server misconfiguration: JWT_SECRET missing' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    
    // Check for admin role
    if (decoded.role !== 'admin') {
      const auditLogger = require('../utils/auditLogger');
      auditLogger.log({
        req,
        action: 'ADMIN_ACCESS_DENIED',
        category: 'AUTHZ',
        severity: 'WARNING',
        outcome: 'BLOCKED',
        statusCode: 403,
        metadata: {
          attemptedRole: decoded.role,
          path: req.originalUrl || req.url,
        },
      });
      return res.status(403).json({ message: 'Not authorized, admin only' });
    }

    const adminId = decoded.id || decoded.userId;
    if (adminId && adminId !== '000000000000000000000000') {
      const query = User.findById(adminId);
      const user = typeof query?.select === 'function' ? await query.select('+tokenVersion') : await query;
      if (!user || decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
      }
      req.user = user;
    }

    req.admin = {
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error('adminMiddleware:', error);
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

module.exports = { protectAdmin };
