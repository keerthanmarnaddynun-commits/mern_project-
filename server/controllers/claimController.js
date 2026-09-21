const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const Activity = require('../models/Activity');
const {
  pickBestMatchingLostForFound,
  getEligibleUserLostFilter,
} = require('../utils/itemSimilarity');
const { extractKeyword } = require('../utils/titleKeyword');

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

    if (item.custodyStatus !== 'department_received') {
      return res.status(400).json({ message: 'Cannot claim an item before it is physically received by the department.' });
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
      department: item.custodyDepartment || item.custodyLocation || null,
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
          itemType: item.type,
          keyword: extractKeyword(item.title)
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
      lostItemId: null,
      canClaim: false,
      canResubmit: false,
      rejectionReason: null,
      itemCustodyStatus: null,
      reason: null,
    };

    const item = await Item.findById(itemId).lean();
    if (!item) {
      return res.status(200).json({ ...base, reason: REASON.NOT_FOUND });
    }

    base.itemCustodyStatus = item.custodyStatus || null;

    const claim = await Claim.findOne({ itemId: item._id, claimant: req.user._id }).lean();
    if (claim) {
      const canResubmit =
        claim.status === 'rejected' &&
        (claim.retryCount || 0) < 1 &&
        !claim.isPermanentlyRejected &&
        item.custodyStatus !== 'returned';

      let rejectionReason = claim.reason || claim.reasonText || null;
      if (!rejectionReason) {
        const rejAct = await Activity.findOne({ claimId: claim._id, type: 'claim_rejected' })
          .sort({ createdAt: -1 })
          .lean();
        if (rejAct?.metadata?.reason) {
          rejectionReason = rejAct.metadata.reason;
        }
      }

      return res.status(200).json({
        hasClaimed: true,
        claimStatus: claim.status,
        claimId: String(claim._id),
        lostItemId: claim.lostItemId ? String(claim.lostItemId) : null,
        canClaim: false,
        canResubmit,
        rejectionReason,
        itemCustodyStatus: item.custodyStatus || null,
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
    if (item.custodyStatus !== 'department_received') {
      return res.status(400).json({ message: 'Cannot claim an item before it is physically received by the department.' });
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
      department: item.custodyDepartment || item.custodyLocation || null,
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
          itemType: item.type,
          keyword: extractKeyword(item.title)
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

const getDepartmentClaims = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Access denied. Faculty role required.' });
    }

    const claims = await Claim.find({ status: 'pending', department: req.user.department })
      .populate('claimant', 'name email')
      .populate({
        path: 'itemId',
        populate: { path: 'postedBy', select: 'name email' },
      })
      .populate({
        path: 'lostItemId',
        populate: { path: 'postedBy', select: 'name email' },
      })
      .sort({ createdAt: 1 })
      .lean();

    const validClaims = claims.filter(
      (claim) => claim.itemId && claim.itemId.custodyStatus === 'department_received'
    );

    return res.status(200).json(validClaims);
  } catch (error) {
    console.error('getDepartmentClaims error:', error);
    return res.status(500).json({ message: 'Server error fetching department claims' });
  }
};

const approveClaim = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Access denied. Faculty role required.' });
    }

    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid claim ID' });
    }

    const { verificationMethod, verificationNotes } = req.body || {};
    if (
      !verificationMethod ||
      !verificationNotes ||
      !verificationMethod.toString().trim() ||
      !verificationNotes.toString().trim()
    ) {
      return res.status(400).json({
        message: 'Verification method and verification notes are required to approve claim.',
      });
    }

    const claim = await Claim.findById(id)
      .populate('claimant', 'name email')
      .populate('itemId')
      .populate('lostItemId');

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ message: `Claim is already ${claim.status}` });
    }

    if (!claim.itemId) {
      return res.status(400).json({ message: 'Associated item for this claim could not be found' });
    }

    // Set the claim status to 'approved' and save audit verification fields
    claim.status = 'approved';
    claim.verificationMethod = verificationMethod.toString().trim();
    claim.verificationNotes = verificationNotes.toString().trim();
    await claim.save();

    // Update Found Item: status resolved, is_resolved true, custodyStatus returned, handoverDate now
    await Item.findByIdAndUpdate(claim.itemId._id, {
      status: 'resolved',
      is_resolved: true,
      custodyStatus: 'returned',
      handoverDate: new Date(),
    });

    // Update Linked Lost Item (if it exists): status resolved, is_resolved true
    if (claim.lostItemId) {
      await Item.findByIdAndUpdate(claim.lostItemId._id, {
        status: 'resolved',
        is_resolved: true,
      });
    }

    // Reject all other pending claims for this exact itemId
    const otherClaims = await Claim.updateMany(
      { itemId: claim.itemId._id, _id: { $ne: claim._id }, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          reason: 'Item was successfully claimed by another user.',
          isPermanentlyRejected: true,
        },
      }
    );

    // Create Activity log entry recording department handover with audit trail
    try {
      await Activity.create({
        type: 'item_resolved',
        message: `Department (${req.user.department || 'Faculty'}) handed over item "${claim.itemId.title}" to ${claim.claimant?.name || 'claimant'}. Verification: ${claim.verificationMethod}. Notes: "${claim.verificationNotes}".`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: claim.itemId.title,
        relatedItemTitle: claim.lostItemId ? claim.lostItemId.title : null,
        claimId: claim._id,
        itemId: claim.itemId._id,
        userId: req.user._id,
        metadata: {
          category: claim.itemId.category || null,
          keyword: extractKeyword(claim.itemId.title),
          department: req.user.department || null,
          role: req.user.role,
          verificationMethod: claim.verificationMethod,
          verificationNotes: claim.verificationNotes,
        },
      });

      await Activity.create({
        type: 'claim_approved',
        message: `Faculty member (${req.user.name}) approved claim for "${claim.itemId.title}". Verification: ${claim.verificationMethod}.`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: claim.itemId.title,
        relatedItemTitle: claim.lostItemId ? claim.lostItemId.title : null,
        claimId: claim._id,
        itemId: claim.itemId._id,
        userId: req.user._id,
        metadata: {
          verificationMethod: claim.verificationMethod,
          verificationNotes: claim.verificationNotes,
        },
      });

      if (otherClaims.modifiedCount > 0) {
        await Activity.create({
          type: 'claim_auto_rejected',
          message: `${otherClaims.modifiedCount} other claim(s) for "${claim.itemId.title}" were automatically rejected following department handover.`,
          actorName: 'System',
          itemId: claim.itemId._id,
        });
      }
    } catch (logErr) {
      console.error('Activity log error (faculty approve claim):', logErr);
    }

    return res.status(200).json({
      message: 'Claim approved and item custody marked as returned successfully',
      approvedClaim: claim,
      autoRejectedCount: otherClaims.modifiedCount || 0,
    });
  } catch (error) {
    console.error('approveClaim error:', error);
    return res.status(500).json({ message: 'Server error approving claim', error: error.message });
  }
};

const facultyApproveClaim = approveClaim;

const rejectClaim = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Access denied. Faculty role required.' });
    }

    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid claim ID' });
    }

    const claim = await Claim.findById(id)
      .populate('claimant', 'name email')
      .populate('itemId');

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ message: `Claim is already ${claim.status}` });
    }

    const { reason, preventResubmit } = req.body || {};

    claim.status = 'rejected';
    if (reason) {
      claim.set('reason', reason, { strict: false });
    }
    if (preventResubmit === true) {
      claim.isPermanentlyRejected = true;
    }
    await claim.save();

    if (claim.lostItemId) {
      await Item.findByIdAndUpdate(claim.lostItemId._id || claim.lostItemId, { isHidden: true });
    }

    try {
      await Activity.create({
        type: 'claim_rejected',
        message: `Faculty member (${req.user.name}) rejected claim for "${claim.itemId?.title || 'item'}" by ${claim.claimant?.name || 'claimant'}.${reason ? ` Reason: ${reason}` : ''}`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: claim.itemId?.title || null,
        claimId: claim._id,
        itemId: claim.itemId?._id || null,
        userId: req.user._id,
        metadata: {
          reason: reason || null,
        },
      });
    } catch (logErr) {
      console.error('Activity log error (reject claim):', logErr);
    }

    return res.status(200).json({
      message: 'Claim rejected successfully',
      rejectedClaim: claim,
    });
  } catch (error) {
    console.error('rejectClaim error:', error);
    return res.status(500).json({ message: 'Server error rejecting claim', error: error.message });
  }
};

const getRecentlyReturned = async (req, res) => {
  try {
    const claims = await Claim.find({
      status: 'approved',
      updatedAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    })
      .populate('itemId')
      .populate('lostItemId')
      .populate('claimant', 'name email')
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json(claims);
  } catch (error) {
    console.error('getRecentlyReturned error:', error);
    return res.status(500).json({ message: 'Server error fetching recently returned claims' });
  }
};

const resubmitClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const { lostItemId, reasonType, reasonText, manualReasonType, manualReasonText } = req.body || {};

    const claim = await Claim.findById(id).populate('itemId');
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.claimant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to resubmit this claim' });
    }

    if (claim.isPermanentlyRejected || (claim.retryCount || 0) >= 1) {
      return res.status(403).json({ message: 'Claim cannot be resubmitted.' });
    }

    if (claim.itemId?.custodyStatus === 'returned') {
      return res.status(400).json({ message: 'This item has already been returned to someone else.' });
    }

    if (lostItemId && mongoose.Types.ObjectId.isValid(lostItemId)) {
      claim.lostItemId = lostItemId;
      await Item.findByIdAndUpdate(lostItemId, { isHidden: false });
    } else if (claim.lostItemId) {
      await Item.findByIdAndUpdate(claim.lostItemId._id || claim.lostItemId, { isHidden: false });
    }

    const selectedReasonType = reasonType || manualReasonType;
    if (selectedReasonType) {
      claim.manualReasonType = selectedReasonType;
    }
    const selectedReasonText = reasonText !== undefined ? reasonText : manualReasonText;
    if (selectedReasonText !== undefined) {
      claim.manualReasonText = selectedReasonText;
    }

    claim.retryCount = (claim.retryCount || 0) + 1;
    claim.status = 'pending';
    await claim.save();

    try {
      await Activity.create({
        type: 'claim_submitted',
        message: `User resubmitted their claim (Attempt 2 of 2)`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        claimId: claim._id,
        itemId: claim.itemId,
        userId: req.user._id,
        metadata: {
          retryCount: claim.retryCount,
          reasonType: claim.manualReasonType,
        },
      });
    } catch (actErr) {
      console.error('Failed to log activity for resubmitClaim:', actErr);
    }

    return res.status(200).json({
      message: 'Claim resubmitted successfully',
      claim,
    });
  } catch (error) {
    console.error('resubmitClaim error:', error);
    return res.status(500).json({ message: 'Server error resubmitting claim', error: error.message });
  }
};

module.exports = {
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
};

