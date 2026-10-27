const express = require('express');
const router = express.Router();
const { getCommunityInsights } = require('../controllers/publicController');

router.get('/stats', getCommunityInsights);
router.get('/community-insights', getCommunityInsights);

module.exports = router;
