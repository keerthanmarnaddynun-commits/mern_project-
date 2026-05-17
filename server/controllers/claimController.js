const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const Activity = require('../models/Activity');
const {
  pickBestMatchingLostForFound,
  getEligibleUserLostFilter,
} = require('../utils/itemSimilarity');

const NO_MATCHING_LOST_MSG = 'Report a matching lost item before claiming this item.';

const REASON = {
  NOT_FOUND: 'Item not found.',
  NOT_FOUND_TYPE: 'Claims apply only to found items.',
  RESOLVED: 'This listing is resolved; claims are closed.',
  OWNER: 'You cannot claim your own listing.',
  NO_MATCH: NO_MATCHING_LOST_MSG,
  ALREADY: 'Claim already submitted',
};

const createClaim = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.type !== 'found') {
      return res.status(400).json({ message: 'Only found items can be claimed' });
    }

    if (item.status === 'resolved' || item.is_resolved === true) {
      return res.status(400).json({ message: 'Cannot claim a resolved item' });
    }

    if (item.postedBy.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot claim your own item' });
    }

    const existing = await Claim.findOne({
      itemId: item._id,
      claimant: req.user._id,
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already submitted a claim for this item' });
    }

    const userLostItems = await Item.find(getEligibleUserLostFilter(req.user._id)).lean();

    const best = pickBestMatchingLostForFound(item, userLostItems, req.user._id);
    if (!best) {
      return res.status(403).json({ message: NO_MATCHING_LOST_MSG });
    }

    const claim = await Claim.create({
      itemId: item._id,
      lostItemId: best.lost._id,
      claimant: req.user._id,
      status: 'pending',
    });

    try {
      await Activity.create({
        type: 'claim_submitted',
        message: `User submitted a claim for "${item.title}" using "${best.lost.title}"`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: item.title,
        relatedItemTitle: best.lost.title,
        claimId: claim._id,
        itemId: item._id,
        userId: req.user._id,
        metadata: {
          category: item.category,
          itemType: item.type
        }
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr);
    }

    return res.status(201).json(claim);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You have already submitted a claim for this item' });
    }
    console.error('createClaim:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getClaimStatus = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid item id' });
    }

    const base = {
      hasClaimed: false,
      claimStatus: null,
      claimId: null,
      canClaim: false,
      reason: null,
    };

    const item = await Item.findById(itemId).lean();
    if (!item) {
      return res.status(200).json({ ...base, reason: REASON.NOT_FOUND });
    }

    const claim = await Claim.findOne({ itemId: item._id, claimant: req.user._id }).lean();
    if (claim) {
      return res.status(200).json({
        hasClaimed: true,
        claimStatus: claim.status,
        claimId: String(claim._id),
        canClaim: false,
        reason: REASON.ALREADY,
      });
    }

    if (item.type !== 'found') {
      return res.status(200).json({ ...base, reason: REASON.NOT_FOUND_TYPE });
    }

    if (item.status === 'resolved' || item.is_resolved === true) {
      return res.status(200).json({ ...base, reason: REASON.RESOLVED });
    }

    if (item.postedBy.toString() === req.user._id.toString()) {
      return res.status(200).json({ ...base, reason: REASON.OWNER });
    }

    const userLostItems = await Item.find(getEligibleUserLostFilter(req.user._id)).lean();
    const best = pickBestMatchingLostForFound(item, userLostItems, req.user._id);
    if (!best) {
      return res.status(200).json({ ...base, reason: REASON.NO_MATCH });
    }

    return res.status(200).json({
      hasClaimed: false,
      claimStatus: null,
      claimId: null,
      canClaim: true,
      reason: null,
    });
  } catch (error) {
    console.error('getClaimStatus:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const createManualClaim = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { lostItemId, reasonType, reasonText } = req.body;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid found item id' });
    }
    if (!lostItemId || !mongoose.Types.ObjectId.isValid(lostItemId)) {
      return res.status(400).json({ message: 'Invalid lost item id' });
    }
    if (!reasonType) {
      return res.status(400).json({ message: 'Reason type is required' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Found item not found' });
    }
    if (item.type !== 'found') {
      return res.status(400).json({ message: 'Only found items can be claimed' });
    }
    if (item.status === 'resolved' || item.is_resolved === true) {
      return res.status(400).json({ message: 'Cannot claim a resolved item' });
    }
    if (item.postedBy.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot claim your own item' });
    }

    const lostItem = await Item.findById(lostItemId);
    if (!lostItem) {
      return res.status(404).json({ message: 'Lost item not found' });
    }
    if (lostItem.type !== 'lost') {
      return res.status(400).json({ message: 'Selected item must be a lost item' });
    }
    if (lostItem.status === 'resolved' || lostItem.is_resolved === true) {
      return res.status(400).json({ message: 'Cannot use a resolved lost item for a claim' });
    }
    if (lostItem.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You must own the lost item to use it' });
    }

    // Check for duplicate manual claim for the exact same found item
    const existing = await Claim.findOne({
      itemId: item._id,
      claimant: req.user._id,
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already submitted a claim for this item' });
    }

    const claim = await Claim.create({
      itemId: item._id,
      lostItemId: lostItem._id,
      claimant: req.user._id,
      status: 'pending',
      claimType: 'manual_review',
      manualReasonType: reasonType,
      manualReasonText: reasonText || '',
    });

    try {
      await Activity.create({
        type: 'manual_review_requested',
        message: `User requested manual review for "${item.title}" using "${lostItem.title}"`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: item.title,
        relatedItemTitle: lostItem.title,
        claimId: claim._id,
        itemId: item._id,
        userId: req.user._id,
        metadata: {
          category: item.category,
          itemType: item.type
        }
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr);
    }

    return res.status(201).json({ message: 'Manual review requested successfully', claim });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You have already submitted a claim for this item' });
    }
    console.error('createManualClaim:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getReceivedClaims = async (req, res) => {
  try {
    const userFoundItems = await Item.find({
      type: 'found',
      postedBy: req.user._id,
    }).select('_id');

    const foundItemIds = userFoundItems.map(item => item._id);

    const receivedClaims = await Claim.find({ itemId: { $in: foundItemIds } })
      .populate('itemId', 'title category location date_occurred')
      .populate('lostItemId', 'title category location date_occurred')
      .populate('claimant', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Sort pending claims first
    receivedClaims.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return 0;
    });

    res.status(200).json(receivedClaims);
  } catch (error) {
    console.error('getReceivedClaims error:', error);
    res.status(500).json({ message: 'Server error fetching received claims' });
  }
};

const getMyClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ claimant: req.user._id })
      .populate('itemId', 'title category location date_occurred status is_resolved')
      .populate('lostItemId', 'title category location date_occurred status is_resolved')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(claims);
  } catch (error) {
    console.error('getMyClaims error:', error);
    res.status(500).json({ message: 'Server error fetching your claims' });
  }
};

module.exports = {
  createClaim,
  getClaimStatus,
  createManualClaim,
  getReceivedClaims,
  getMyClaims,
};
