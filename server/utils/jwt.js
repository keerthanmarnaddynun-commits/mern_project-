const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim() === '') {
    const err = new Error(
      'JWT_SECRET is not configured. Add JWT_SECRET to your server .env file (a long random string).'
    );
    err.code = 'JWT_SECRET_MISSING';
    throw err;
  }
  return secret;
}

/**
 * Signs a JWT token including id, role, and tokenVersion in the payload.
 *
 * @param {Object|string} user - User document, user object, or user ID
 * @param {Object} [options] - Options for jwt.sign (e.g. expiresIn)
 * @returns {string} Signed JWT
 */
function signToken(user, options = {}) {
  let userId;
  let role = 'user';
  let tokenVersion = 0;
  let email;

  if (typeof user === 'string' || (user && user._bsontype === 'ObjectID')) {
    userId = String(user);
  } else if (user && typeof user === 'object') {
    userId = String(user._id || user.id || user.userId || '');
    role = user.role || 'user';
    tokenVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : 0;
    if (user.email) {
      email = user.email;
    }
  }

  const payload = {
    id: userId,
    userId: userId, // Backward compatibility
    role,
    tokenVersion,
  };

  if (email) {
    payload.email = email;
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: options.expiresIn || '7d',
  });
}

module.exports = {
  getJwtSecret,
  signToken,
};
