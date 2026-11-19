const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Whitelisted developer IP addresses for local development
const WHITELISTED_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * Skip rate limiting for local developer loopback addresses.
 */
const isWhitelistedIp = (req) => {
  return WHITELISTED_IPS.includes(req.ip);
};

const getRequesterKey = (req) => {
  try {
    let token = req.cookies?.token;
    if (!token && typeof req.headers?.authorization === 'string') {
      const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization.trim());
      if (match) {
        token = match[1].trim();
      }
    }
    if (token && process.env.JWT_SECRET) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const id = payload?.id || payload?.userId;
      if (id) {
        return `user:${id}`;
      }
    }
  } catch {
    // Fall back to IP key when token is missing, invalid, or expired
  }
  return `ip:${req.ip ? ipKeyGenerator(req.ip) : 'unknown'}`;
};

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelistedIp,
  message: {
    message: 'Too many accounts created from this IP. Please try again later.',
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelistedIp,
  keyGenerator: (req, res) => req.user?._id?.toString() || req.user?.id || getRequesterKey(req, res),
  message: {
    message: 'Upload limit exceeded. Please try again later.',
  },
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelistedIp,
  keyGenerator: (req, res) => req.user?._id?.toString() || req.user?.id || getRequesterKey(req, res),
  message: {
    message: 'Too many attempts. Please try again later.',
  },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelistedIp,
  message: {
    message: 'Too many verification attempts. Please try again later.',
  },
});

const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelistedIp,
  keyGenerator: (req, res) => req.user?._id?.toString() || req.user?.id || getRequesterKey(req, res),
  message: {
    message: 'Too many verification email requests. Please try again later.',
  },
});

module.exports = {
  registerLimiter,
  uploadLimiter,
  sensitiveActionLimiter,
  verificationLimiter,
  resendVerificationLimiter,
  getRequesterKey,
  isWhitelistedIp,
  WHITELISTED_IPS,
};

