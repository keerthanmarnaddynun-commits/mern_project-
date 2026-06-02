const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Activity = require('../models/Activity');
const { matchOppositePendingSameCategory } = require('../utils/itemSimilarity');
const { extractKeyword } = require('../utils/titleKeyword');

// POST /api/admin/login
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  const inputEmail = String(email || '').trim().toLowerCase();
  const inputPassword = String(password || '').trim();

  if (inputEmail === adminEmail && inputPassword === adminPassword && adminEmail !== '') {
    const token = jwt.sign(
      { email: adminEmail, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({
      token,
      admin: {
        email,
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({ message: 'Invalid admin credentials' });
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
  try {
    const claim = await Claim.findById(req.params.claimId)
      .populate('claimant')
      .populate('itemId')
      .populate('lostItemId');

    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    if (claim.status !== 'pending') return res.status(400).json({ message: 'Claim is already ' + claim.status });

    // Approve claim
    claim.status = 'approved';
    await claim.save();

    // Mark items as resolved
    await Item.findByIdAndUpdate(claim.itemId._id, {
      status: 'resolved',
      is_resolved: true,
      custodyStatus: 'returned',
    });
    await Item.findByIdAndUpdate(claim.lostItemId._id, { status: 'resolved', is_resolved: true });

    // Auto-reject other claims for the same found item
    const otherClaims = await Claim.updateMany(
      { itemId: claim.itemId._id, _id: { $ne: claim._id }, status: 'pending' },
      { $set: { status: 'rejected' } }
    );

    // Logging Activity
    try {
      await Activity.create({
        type: 'claim_approved',
        message: `Admin approved claim for found item "${claim.itemId.title}" using lost item "${claim.lostItemId.title}"`,
        actorName: 'Admin',
        actorEmail: req.admin.email,
        itemTitle: claim.itemId.title,
        relatedItemTitle: claim.lostItemId.title,
        claimId: claim._id,
        itemId: claim.itemId._id,
      });

      await Activity.create({
        type: 'item_resolved',
        message: `Items "${claim.itemId.title}" and "${claim.lostItemId.title}" marked as resolved.`,
        actorName: 'Admin',
        actorEmail: req.admin.email,
        metadata: {
          category: claim.itemId.category || null,
          keyword: extractKeyword(claim.itemId.title)
        }
      });

      if (otherClaims.modifiedCount > 0) {
        await Activity.create({
          type: 'claim_auto_rejected',
          message: `${otherClaims.modifiedCount} other claim(s) for "${claim.itemId.title}" were automatically rejected.`,
          actorName: 'System',
          itemId: claim.itemId._id,
        });
      }
    } catch (logErr) {
      console.error('Activity log error (approve claim):', logErr);
    }

    res.json({
      message: 'Claim approved successfully',
      approvedClaim: claim,
      autoRejectedCount: otherClaims.modifiedCount || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error approving claim' });
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
      .populate('postedBy', 'name email');
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching all items' });
  }
};

// GET /api/admin/activity
const getActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
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
  getActivity
};
