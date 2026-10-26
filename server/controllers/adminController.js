const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Activity = require('../models/Activity');
const Dispute = require('../models/Dispute');
const { matchOppositePendingSameCategory } = require('../utils/itemSimilarity');
const { extractKeyword } = require('../utils/titleKeyword');
const { issueCsrfToken } = require('../middleware/csrf');
const { signToken } = require('../utils/jwt');

// POST /api/admin/login
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const inputEmail = String(email).trim().toLowerCase();
    const inputPassword = String(password).trim();

    // 1. Query MongoDB users collection for user with role: 'admin'
    const adminUser = await User.findOne({ email: inputEmail, role: 'admin' }).select('+password +tokenVersion');

    let isValid = false;
    let verifiedEmail = inputEmail;

    if (adminUser && adminUser.password) {
      isValid = await bcrypt.compare(inputPassword, adminUser.password);
      verifiedEmail = adminUser.email;
    }

    // 2. Fallback to environment variables if configured
    if (!isValid) {
      const envAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const envAdminPassword = String(process.env.ADMIN_PASSWORD || '').trim();

      if (envAdminEmail && inputEmail === envAdminEmail && inputPassword === envAdminPassword) {
        isValid = true;
        verifiedEmail = envAdminEmail;
      }
    }

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = signToken(
      adminUser || {
        id: '000000000000000000000000',
        email: verifiedEmail,
        role: 'admin',
        tokenVersion: 0,
      },
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const csrfToken = issueCsrfToken(res);

    return res.status(200).json({
      token,
      csrfToken,
      admin: {
        email: verifiedEmail,
        role: 'admin',
        name: adminUser?.name || 'System Admin',
      },
      isAdmin: true,
    });
  } catch (error) {
    console.error('loginAdmin error:', error);
    return res.status(500).json({ message: 'Server error during admin login' });
  }
};

// GET /api/admin/overview
const getOverview = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalItems = await Item.countDocuments();
    const lostItems = await Item.countDocuments({ type: 'lost' });
    const foundItems = await Item.countDocuments({ type: 'found' });
    const pendingItems = await Item.countDocuments({ status: 'pending' });
    const resolvedItems = await Item.countDocuments({ is_resolved: true });
    
    const totalClaims = await Claim.countDocuments();
    const pendingClaims = await Claim.countDocuments({ status: 'pending' });
    const approvedClaims = await Claim.countDocuments({ status: 'approved' });
    const rejectedClaims = await Claim.countDocuments({ status: 'rejected' });

    res.json({
      totalUsers,
      totalItems,
      lostItems,
      foundItems,
      pendingItems,
      resolvedItems,
      totalClaims,
      pendingClaims,
      approvedClaims,
      rejectedClaims
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching overview' });
  }
};

// GET /api/admin/claims
const getClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ status: 'pending' })
      .populate('claimant', 'name email')
      .populate({
        path: 'itemId', // Found item
        populate: { path: 'postedBy', select: 'name email' }
      })
      .populate({
        path: 'lostItemId', // Lost item
        populate: { path: 'postedBy', select: 'name email' }
      })
      .limit(100)
      .lean();

    // Sort by type (automatic first), then confidence, then oldest first
    claims.sort((a, b) => {
      let aRank = 0;
      let bRank = 0;
      let aDate = new Date(a.createdAt).getTime();
      let bDate = new Date(b.createdAt).getTime();

      const aType = a.claimType || 'automatic';
      const bType = b.claimType || 'automatic';

      if (aType !== bType) {
        return aType === 'automatic' ? -1 : 1;
      }

      // If confidence not stored, calculate dynamically
      if (a.itemId && a.lostItemId) {
        const m = matchOppositePendingSameCategory(a.itemId, a.lostItemId);
        if (m) aRank = m.rank;
      }
      if (b.itemId && b.lostItemId) {
        const m = matchOppositePendingSameCategory(b.itemId, b.lostItemId);
        if (m) bRank = m.rank;
      }

      if (aRank !== bRank) return bRank - aRank; // Higher rank first
      return aDate - bDate; // Oldest first
    });

    const formattedClaims = claims.map(c => ({
      _id: c._id,
      status: c.status,
      createdAt: c.createdAt,
      claimType: c.claimType || 'automatic',
      manualReasonType: c.manualReasonType || null,
      manualReasonText: c.manualReasonText || null,
      foundItem: c.itemId || null,
      lostItem: c.lostItemId || null,
      claimant: c.claimant || null,
      foundReporter: c.itemId ? c.itemId.postedBy : null,
      lostReporter: c.lostItemId ? c.lostItemId.postedBy : null,
    }));

    res.json(formattedClaims);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching claims' });
  }
};

// PATCH /api/admin/claims/:claimId/approve
const approveClaim = async (req, res) => {
  const { claimId } = req.params;
  if (!claimId || !mongoose.Types.ObjectId.isValid(claimId)) {
    return res.status(400).json({ message: 'Valid claim ID is required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const claim = await Claim.findById(claimId)
      .populate('claimant', 'name email')
      .populate('itemId')
      .populate('lostItemId')
      .session(session);

    if (!claim) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Claim not found' });
    }

    const isReadyForPickup = claim.itemId?.custodyStatus === 'ready_for_pickup';

    if (!isReadyForPickup && claim.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Claim is already ' + claim.status });
    }

    if (isReadyForPickup) {
      // 1. Query Dispute collection for the resolved dispute linked to this itemId
      const dispute = await Dispute.findOne({
        itemId: claim.itemId._id,
        status: { $in: ['resolved', 'ready_for_pickup'] },
      }).sort({ updatedAt: -1 }).session(session);

      const originalOwnerId = dispute?.currentOwnerId;

      // 2. Revoke original incorrect claim
      let incorrectClaim = null;
      if (originalOwnerId) {
        incorrectClaim = await Claim.findOne({
          itemId: claim.itemId._id,
          claimant: originalOwnerId,
        }).session(session);
      }
      if (!incorrectClaim) {
        incorrectClaim = await Claim.findOne({
          itemId: claim.itemId._id,
          _id: { $ne: claim._id },
          status: 'approved',
        }).session(session);
      }

      if (incorrectClaim) {
        incorrectClaim.status = 'revoked';
        incorrectClaim.reason = 'Claim revoked following dispute resolution and handover to rightful owner.';
        await incorrectClaim.save({ session });
      }

      // 3. Approve challenger's claim
      claim.status = 'approved';
      await claim.save({ session });

      // 4. Update items
      claim.itemId.status = 'resolved';
      claim.itemId.is_resolved = true;
      claim.itemId.custodyStatus = 'returned';
      claim.itemId.handoverDate = new Date();
      await claim.itemId.save({ session });

      if (claim.lostItemId) {
        claim.lostItemId.status = 'resolved';
        claim.lostItemId.is_resolved = true;
        await claim.lostItemId.save({ session });
      }

      // Log Activity (type: 'handover_completed')
      await Activity.create([
        {
          type: 'handover_completed',
          message: `Admin completed final handover for item "${claim.itemId.title}" to rightful owner ${claim.claimant?.name || 'claimant'}.`,
          actorName: 'Admin',
          actorEmail: req.admin?.email,
          itemTitle: claim.itemId.title,
          relatedItemTitle: claim.lostItemId ? claim.lostItemId.title : null,
          claimId: claim._id,
          itemId: claim.itemId._id,
          userId: claim.claimant?._id || claim.claimant,
          metadata: {
            disputeId: dispute?._id || null,
            challengerId: claim.claimant?._id || claim.claimant,
            revokedClaimOwnerId: originalOwnerId || null,
            custodyStatus: 'returned',
          },
        }
      ], { session });

      await session.commitTransaction();

      return res.json({
        message: 'Recovered item handed over to rightful owner successfully',
        approvedClaim: claim,
        revokedClaim: incorrectClaim,
      });
    }

    // Approve claim
    claim.status = 'approved';
    await claim.save({ session });

    // Mark items as resolved
    await Item.findByIdAndUpdate(claim.itemId._id, {
      status: 'resolved',
      is_resolved: true,
      custodyStatus: 'returned',
    }, { session });

    if (claim.lostItemId) {
      await Item.findByIdAndUpdate(claim.lostItemId._id, {
        status: 'resolved',
        is_resolved: true,
      }, { session });
    }

    // Auto-reject other claims for the same found item
    const otherClaims = await Claim.updateMany(
      { itemId: claim.itemId._id, _id: { $ne: claim._id }, status: 'pending' },
      { $set: { status: 'rejected' } },
      { session }
    );

    // Logging Activity
    const activitiesToLog = [
      {
        type: 'claim_approved',
        message: `Admin approved claim for found item "${claim.itemId.title}" using lost item "${claim.lostItemId?.title || ''}"`,
        actorName: 'Admin',
        actorEmail: req.admin?.email,
        itemTitle: claim.itemId.title,
        relatedItemTitle: claim.lostItemId?.title || null,
        claimId: claim._id,
        itemId: claim.itemId._id,
      },
      {
        type: 'item_resolved',
        message: `Items "${claim.itemId.title}" and "${claim.lostItemId?.title || ''}" marked as resolved.`,
        actorName: 'Admin',
        actorEmail: req.admin?.email,
        metadata: {
          category: claim.itemId.category || null,
          keyword: extractKeyword(claim.itemId.title),
        },
      }
    ];

    if (otherClaims.modifiedCount > 0) {
      activitiesToLog.push({
        type: 'claim_auto_rejected',
        message: `${otherClaims.modifiedCount} other claim(s) for "${claim.itemId.title}" were automatically rejected.`,
        actorName: 'System',
        itemId: claim.itemId._id,
      });
    }

    await Activity.create(activitiesToLog, { session });

    await session.commitTransaction();

    return res.json({
      message: 'Claim approved successfully',
      approvedClaim: claim,
      autoRejectedCount: otherClaims.modifiedCount || 0,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('admin approveClaim error:', error);
    return res.status(500).json({ message: 'Server error approving claim', error: error.message });
  } finally {
    session.endSession();
  }
};

// PATCH /api/admin/claims/:claimId/reject
const rejectClaim = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.claimId)
      .populate('itemId')
      .populate('lostItemId');

    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    if (claim.status !== 'pending') return res.status(400).json({ message: 'Claim is already ' + claim.status });

    claim.status = 'rejected';
    await claim.save();

    // Log Activity
    try {
      await Activity.create({
        type: 'claim_rejected',
        message: `Admin rejected claim for found item "${claim.itemId.title}" using lost item "${claim.lostItemId.title}"`,
        actorName: 'Admin',
        actorEmail: req.admin.email,
        claimId: claim._id,
      });
    } catch (logErr) {
      console.error('Activity log error (reject claim):', logErr);
    }

    res.json({ message: 'Claim rejected successfully', claim });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error rejecting claim' });
  }
};

// GET /api/admin/items
const getAllItems = async (req, res) => {
  try {
    const items = await Item.find()
      .sort({ createdAt: -1 })
      .populate('postedBy', 'name email')
      .limit(100)
      .lean();

    const itemIds = items.map((i) => i._id);
    const approvedClaims = await Claim.find({
      itemId: { $in: itemIds },
      status: 'approved',
    })
      .populate('claimant', 'name email')
      .lean();

    const claimMap = {};
    approvedClaims.forEach((c) => {
      claimMap[c.itemId.toString()] = c.claimant;
    });

    const itemsWithClaimant = items.map((item) => ({
      ...item,
      claimant: claimMap[item._id.toString()] || null,
    }));

    res.json(itemsWithClaimant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching all items' });
  }
};

// PATCH /api/admin/items/:id/close-dispute
const closeDispute = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Access denied: Admin only' });
    }

    const item = await Item.findById(req.params.id).populate('postedBy', 'name email');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.isDisputed = false;
    // Set handoverDate to epoch zero to immediately age out of public 48-hour feed
    item.handoverDate = new Date(0);
    await item.save();

    // Create an Activity log entry stating the admin resolved/closed the dispute
    try {
      await Activity.create({
        type: 'dispute_closed',
        message: `Admin resolved and closed dispute for item "${item.title}". Handover aged out and item locked.`,
        actorName: 'Admin',
        actorEmail: req.admin.email,
        itemId: item._id,
        itemTitle: item.title,
      });
    } catch (logErr) {
      console.error('Activity log error (close dispute):', logErr);
    }

    res.json({
      message: 'Dispute closed and item locked successfully',
      item,
    });
  } catch (error) {
    console.error('Error closing dispute:', error);
    res.status(500).json({ message: 'Server error closing dispute' });
  }
};

// GET /api/admin/activity
const getActivity = async (req, res) => {
  try {
    const requestedLimit = parseInt(req.query.limit) || 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(activities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching activity logs' });
  }
};

module.exports = {
  loginAdmin,
  getOverview,
  getClaims,
  approveClaim,
  rejectClaim,
  getAllItems,
  getActivity,
  closeDispute,
};

