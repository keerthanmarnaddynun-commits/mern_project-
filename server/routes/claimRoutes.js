const express = require('express');
const router = express.Router();
const { protect, authorize, requireVerifiedEmail } = require('../middleware/authMiddleware');
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
router.patch('/:id/approve', protect, requireVerifiedEmail, authorize('admin', 'faculty'), validateObjectId, approveClaim);
router.patch('/:id/faculty-approve', protect, requireVerifiedEmail, authorize('admin', 'faculty'), validateObjectId, approveClaim);
router.patch('/:id/reject', protect, requireVerifiedEmail, authorize('admin', 'faculty'), validateObjectId, rejectClaim);

// User claim creation and resubmission
router.post('/manual/:itemId', protect, requireVerifiedEmail, validateObjectId('itemId'), createManualClaim);
router.patch('/:id/resubmit', protect, requireVerifiedEmail, validateObjectId, resubmitClaim);
router.post('/:itemId', protect, requireVerifiedEmail, validateObjectId('itemId'), createClaim);

// User claim modification & deletion (protected with BOLA ownership checks in controller)
router.route('/:id')
  .patch(protect, requireVerifiedEmail, validateObjectId, updateClaim)
  .delete(protect, requireVerifiedEmail, validateObjectId, deleteClaim);

module.exports = router;
