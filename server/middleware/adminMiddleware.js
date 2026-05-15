const jwt = require('jsonwebtoken');

const protectAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.slice(7).trim();
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
      return res.status(403).json({ message: 'Not authorized, admin only' });
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
