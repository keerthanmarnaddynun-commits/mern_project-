const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createClaim, getClaimStatus, createManualClaim, getReceivedClaims, getMyClaims } = require('../controllers/claimController');

router.get('/received', protect, getReceivedClaims);
router.get('/my-claims', protect, getMyClaims);
router.get('/item/:itemId/status', protect, getClaimStatus);
router.post('/manual/:itemId', protect, createManualClaim);
router.post('/:itemId', protect, createClaim);

module.exports = router;
