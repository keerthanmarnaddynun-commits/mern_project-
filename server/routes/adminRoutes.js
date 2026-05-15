const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminMiddleware');
const {
  loginAdmin,
  getOverview,
  getClaims,
  approveClaim,
  rejectClaim,
  getAllItems,
  getActivity
} = require('../controllers/adminController');

// Public admin route
router.post('/login', loginAdmin);

// Protected admin routes
router.get('/overview', protectAdmin, getOverview);
router.get('/claims', protectAdmin, getClaims);
router.patch('/claims/:claimId/approve', protectAdmin, approveClaim);
router.patch('/claims/:claimId/reject', protectAdmin, rejectClaim);
router.get('/items', protectAdmin, getAllItems);
router.get('/activity', protectAdmin, getActivity);

module.exports = router;
