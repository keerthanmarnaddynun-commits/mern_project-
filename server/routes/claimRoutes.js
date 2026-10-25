const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const {
  createClaim,
  getClaimStatus,
  createManualClaim,
  getReceivedClaims,
  getMyClaims,
  getDepartmentClaims,
  approveClaim,
  facultyApproveClaim,
  rejectClaim,
  getRecentlyReturned,
  resubmitClaim,
  updateClaim,
  deleteClaim,
} = require('../controllers/claimController');

// Public/authenticated user claim views
router.get('/recently-returned', protect, getRecentlyReturned);
router.get('/received', protect, getReceivedClaims);
router.get('/my-claims', protect, getMyClaims);
router.get('/item/:itemId/status', protect, validateObjectId('itemId'), getClaimStatus);

// Faculty & Admin restricted department views and actions
router.get('/department', protect, authorize('admin', 'faculty'), getDepartmentClaims);
router.patch('/:id/approve', protect, authorize('admin', 'faculty'), validateObjectId, approveClaim);
router.patch('/:id/faculty-approve', protect, authorize('admin', 'faculty'), validateObjectId, approveClaim);
router.patch('/:id/reject', protect, authorize('admin', 'faculty'), validateObjectId, rejectClaim);

// User claim creation and resubmission
router.post('/manual/:itemId', protect, validateObjectId('itemId'), createManualClaim);
router.patch('/:id/resubmit', protect, validateObjectId, resubmitClaim);
router.post('/:itemId', protect, validateObjectId('itemId'), createClaim);

// User claim modification & deletion (protected with BOLA ownership checks in controller)
router.route('/:id')
  .patch(protect, validateObjectId, updateClaim)
  .delete(protect, validateObjectId, deleteClaim);

module.exports = router;
