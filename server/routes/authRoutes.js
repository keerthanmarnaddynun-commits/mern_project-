const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  verifyEmail,
  resendVerification,
} = require('../controllers/authController');
const { changePassword } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const {
  registerLimiter,
  verificationLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimiters');

router.post('/register', registerLimiter, registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/logout', logoutUser);
router.get('/verify-email', verificationLimiter, verifyEmail);
router.post('/verify-email', verificationLimiter, verifyEmail);
router.post('/resend-verification', protect, resendVerificationLimiter, resendVerification);
router.post('/change-password', protect, changePassword);
router.get('/me', protect, getMe);

module.exports = router;