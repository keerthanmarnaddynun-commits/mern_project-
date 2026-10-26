const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Whitelisted developer IP addresses for local development
const WHITELISTED_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * Skip rate limiting for local developer loopback addresses.
 */
const isWhitelistedIp = (req) => {
  return WHITELISTED_IPS.includes(req.ip);
};

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
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
  keyGenerator: (req, res) => req.user?._id?.toString() || req.user?.id || ipKeyGenerator(req, res),
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
  keyGenerator: (req, res) => req.user?._id?.toString() || req.user?.id || ipKeyGenerator(req, res),
  message: {
    message: 'Too many attempts. Please try again later.',
  },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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
  keyGenerator: (req, res) => req.user?._id?.toString() || req.user?.id || ipKeyGenerator(req, res),
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
  isWhitelistedIp,
  WHITELISTED_IPS,
};

