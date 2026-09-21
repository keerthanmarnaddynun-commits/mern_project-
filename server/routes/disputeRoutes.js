const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  submitDispute,
  getAllDisputes,
  resolveDispute,
  confirmReturn,
} = require('../controllers/disputeController');

// Submit dispute (authenticated user/claimant)
router.post('/', protect, submitDispute);

// Admin & Faculty routes
router.get('/', protect, authorize('admin', 'faculty'), getAllDisputes);
router.patch('/:id/resolve', protect, authorize('admin', 'faculty'), resolveDispute);
router.patch('/:id/recover', protect, authorize('admin', 'faculty'), confirmReturn);

module.exports = router;
