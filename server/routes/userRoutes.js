const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getProfile, updateProfile, deleteProfile } = require('../controllers/userController');

router.route('/me')
  .get(protect, getProfile)
  .patch(protect, updateProfile)
  .delete(protect, deleteProfile);

module.exports = router;
