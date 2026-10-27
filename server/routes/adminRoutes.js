const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const {
  loginAdmin,
  getOverview,
  getClaims,
  approveClaim,
  rejectClaim,
  getAllItems,
  getActivity,
  closeDispute,
  getAuditLogs,
} = require('../controllers/adminController');
const { handoverItem } = require('../controllers/itemController');

// Public admin route
router.post('/login', loginAdmin);

// Protected admin routes
router.get('/overview', protectAdmin, getOverview);
router.get('/claims', protectAdmin, getClaims);
router.patch('/claims/:claimId/approve', protectAdmin, validateObjectId('claimId'), approveClaim);
router.patch('/claims/:claimId/reject', protectAdmin, validateObjectId('claimId'), rejectClaim);
router.get('/items', protectAdmin, getAllItems);
router.patch('/items/:id/handover', protectAdmin, validateObjectId, handoverItem);
router.patch('/items/:id/close-dispute', protectAdmin, validateObjectId, closeDispute);
router.get('/activity', protectAdmin, getActivity);
router.get('/audit-logs', protectAdmin, getAuditLogs);

module.exports = router;
