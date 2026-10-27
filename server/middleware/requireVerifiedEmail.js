/**
 * Middleware ensuring the authenticated user has verified their email address.
 * Blocks unverified accounts from performing sensitive actions (reporting items,
 * submitting claims/disputes, uploading media).
 * Admins are not blocked.
 */
const requireVerifiedEmail = (req, res, next) => {
  // If request has admin role, allow through
  const role = req.user?.role || req.admin?.role;
  if (role === 'admin') {
    return next();
  }

  // Ensure user is authenticated
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized, no session found' });
  }

  // Check email verification status
  if (!req.user.isVerified) {
    const auditLogger = require('../utils/auditLogger');
    auditLogger.log({
      req,
      action: 'UNVERIFIED_EMAIL_BLOCKED',
      category: 'AUTHZ',
      severity: 'WARNING',
      outcome: 'BLOCKED',
      statusCode: 403,
      targetType: 'User',
      targetId: req.user._id,
      metadata: { email: req.user.email, path: req.originalUrl || req.url },
    });
    return res.status(403).json({
      message: 'Please verify your email address before performing this action.',
    });
  }

  next();
};

module.exports = requireVerifiedEmail;
module.exports.requireVerifiedEmail = requireVerifiedEmail;
