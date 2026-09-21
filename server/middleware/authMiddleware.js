const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Requires Authorization: Bearer <token>.
 * Verifies JWT, loads user, sets req.user (Mongoose document, password excluded).
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.slice(7).trim();
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
    req.admin = { email: decoded.email, role: 'admin' };
    req.user = {
      _id: '000000000000000000000000',
      name: 'System Admin',
      email: decoded.email,
      role: 'admin',
    };
    return next();
  }

  const userId = decoded.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('authMiddleware:', err);
    return res.status(401).json({ message: 'Not authorized' });
  }
};

/**
 * Authorize specific roles (e.g. 'admin', 'faculty').
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role || req.admin?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

module.exports = { protect, authorize };
