const express = require('express');
const router = express.Router();
const { protect, authorize, requireVerifiedEmail } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const {
  submitDispute,
  getAllDisputes,
  resolveDispute,
  confirmReturn,
} = require('../controllers/disputeController');

// Submit dispute (authenticated user/claimant)
router.post('/', protect, requireVerifiedEmail, submitDispute);

// Admin & Faculty routes
router.get('/', protect, authorize('admin', 'faculty'), getAllDisputes);
router.patch('/:id/resolve', protect, authorize('admin', 'faculty'), validateObjectId, resolveDispute);
router.patch('/:id/recover', protect, authorize('admin', 'faculty'), validateObjectId, confirmReturn);

module.exports = router;
