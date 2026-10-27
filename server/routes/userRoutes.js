const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getProfile, updateProfile, deleteProfile, changePassword } = require('../controllers/userController');
const { loginUser } = require('../controllers/authController');
const { sensitiveActionLimiter } = require('../middleware/rateLimiters');

router.post('/login', loginUser);

router.route('/change-password')
  .post(protect, sensitiveActionLimiter, changePassword)
  .put(protect, sensitiveActionLimiter, changePassword);

router.route('/me')
  .get(protect, getProfile)
  .patch(protect, sensitiveActionLimiter, updateProfile)
  .put(protect, sensitiveActionLimiter, updateProfile)
  .delete(protect, sensitiveActionLimiter, deleteProfile);

router.route('/profile')
  .get(protect, getProfile)
  .patch(protect, sensitiveActionLimiter, updateProfile)
  .put(protect, sensitiveActionLimiter, updateProfile)
  .delete(protect, sensitiveActionLimiter, deleteProfile);

module.exports = router;
