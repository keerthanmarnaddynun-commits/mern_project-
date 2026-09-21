const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
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
} = require('../controllers/claimController');

router.get('/recently-returned', protect, getRecentlyReturned);
router.get('/received', protect, getReceivedClaims);
router.get('/my-claims', protect, getMyClaims);
router.get('/department', protect, getDepartmentClaims);
router.get('/item/:itemId/status', protect, getClaimStatus);
router.post('/manual/:itemId', protect, createManualClaim);
router.patch('/:id/approve', protect, approveClaim);
router.patch('/:id/faculty-approve', protect, approveClaim);
router.patch('/:id/reject', protect, rejectClaim);
router.patch('/:id/resubmit', protect, resubmitClaim);
router.post('/:itemId', protect, createClaim);

module.exports = router;
