const mongoose = require('mongoose');
const Dispute = require('../models/Dispute');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const auditLogger = require('../utils/auditLogger');

const submitDispute = async (req, res) => {
  const itemId = req.body.itemId || req.params.itemId;
  const { reason, proofUrl } = req.body || {};

  if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ message: 'Valid item ID is required' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: 'Dispute reason is required' });
  }

  const trimmedProofUrl = proofUrl ? String(proofUrl).trim() : '';
  let normalizedProofUrl = null;
  if (trimmedProofUrl) {
    try {
      const parsed = new URL(trimmedProofUrl);
      if (parsed.protocol !== 'https:') {
        return res.status(400).json({ message: 'Proof URL must be a valid HTTPS URL' });
      }
      normalizedProofUrl = trimmedProofUrl;
    } catch {
      return res.status(400).json({ message: 'Proof URL must be a valid HTTPS URL' });
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const item = await Item.findById(itemId).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.custodyStatus !== 'returned') {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Only items with returned custody status can be disputed.',
      });
    }

    const approvedClaim = await Claim.findOne({
      itemId: item._id,
      status: 'approved',
    }).session(session);

    if (!approvedClaim || !approvedClaim.claimant) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'No approved claim found for this item to contest.',
      });
    }

    const currentOwnerId = approvedClaim.claimant;

    if (currentOwnerId.toString() === req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'You cannot dispute an item that was returned to you.',
      });
    }

    const existingPendingDispute = await Dispute.findOne({
      itemId: item._id,
      challengerId: req.user._id,
      status: 'pending',
    }).session(session);

    if (existingPendingDispute) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'You already have a pending dispute for this item.',
      });
    }

    // 1. Instantiate the Dispute document
    const dispute = new Dispute({
      itemId: item._id,
      challengerId: req.user._id,
      currentOwnerId,
      reason: reason.trim(),
      proofUrl: normalizedProofUrl,
      status: 'pending',
      adminNotes: null,
    });

    // 2. Persist to MongoDB with session
    const savedDispute = await dispute.save({ session });

    // 3. Update Item flags with session
    item.isDisputed = true;
    item.disputeReason = reason.trim();
    if (normalizedProofUrl) {
      item.disputeProofUrl = normalizedProofUrl;
    }
    await item.save({ session });

    // 4. Activity log with session
    await Activity.create([
      {
        type: 'dispute_raised',
        message: `Dispute raised on returned item "${item.title}": ${reason.trim()}`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: item.title,
        itemId: item._id,
        userId: req.user._id,
        metadata: {
          disputeId: savedDispute._id,
          challengerId: req.user._id,
          currentOwnerId,
          reason: reason.trim(),
          proofUrl: normalizedProofUrl,
        },
      }
    ], { session });

    await session.commitTransaction();

    auditLogger.log({
      req,
      actorId: req.user._id,
      action: 'DISPUTE_ESCALATED',
      category: 'DISPUTE',
      severity: 'WARNING',
      outcome: 'SUCCESS',
      statusCode: 201,
      targetType: 'Dispute',
      targetId: savedDispute._id,
      metadata: { itemId: item._id, reason: reason.trim() },
    });

    return res.status(201).json({
      message: 'Dispute submitted successfully',
      dispute: savedDispute,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('submitDispute error:', error);
    return res.status(500).json({
      message: 'Server error submitting dispute',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

const getAllDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate('itemId', 'title image_url category location custodyStatus isDisputed status')
      .populate('challengerId', 'name email')
      .populate('currentOwnerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json(disputes);
  } catch (error) {
    console.error('getAllDisputes error:', error);
    return res.status(500).json({
      message: 'Server error fetching disputes',
      error: error.message,
    });
  }
};

const resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNotes } = req.body || {};

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        message: "Action is required and must be either 'approve' or 'reject'.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid dispute ID' });
    }

    const dispute = await Dispute.findById(id)
      .populate('itemId', 'title image_url category location custodyStatus isDisputed status')
      .populate('challengerId', 'name email')
      .populate('currentOwnerId', 'name email');

    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    const item = await Item.findById(dispute.itemId?._id || dispute.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Associated item not found' });
    }

    if (action === 'reject') {
      dispute.status = 'rejected';
      item.isDisputed = false;
    } else if (action === 'approve') {
      dispute.status = 'recall_pending';
      item.custodyStatus = 'recall_pending';
      item.isDisputed = false;
    }

    if (adminNotes !== undefined) {
      dispute.adminNotes = adminNotes ? adminNotes.trim() : null;
    }

    await dispute.save();
    await item.save();

    const actorName = req.user?.name || req.admin?.email || 'Administrator';
    const actorEmail = req.user?.email || req.admin?.email || 'admin@system.local';

    // Log Activity
    try {
      await Activity.create({
        type: action === 'approve' ? 'dispute_resolved' : 'dispute_closed',
        message:
          action === 'approve'
            ? `Dispute approved (recall initiated) for item "${item.title}". Admin notes: ${adminNotes ? adminNotes.trim() : 'None'}`
            : `Dispute rejected for item "${item.title}". Current owner retains item. Admin notes: ${adminNotes ? adminNotes.trim() : 'None'}`,
        actorName,
        actorEmail,
        itemTitle: item.title,
        itemId: item._id,
        userId: dispute.challengerId?._id || null,
        metadata: {
          disputeId: dispute._id,
          action,
          adminNotes: adminNotes ? adminNotes.trim() : null,
          challengerId: dispute.challengerId?._id || null,
          currentOwnerId: dispute.currentOwnerId?._id || null,
        },
      });
    } catch (actErr) {
      console.error('Activity logging error (resolveDispute):', actErr);
    }

    // Explicit Notification documents when approved (Initiate Recall)
    if (action === 'approve') {
      try {
        const currentOwnerUserId = dispute.currentOwnerId?._id || dispute.currentOwnerId;
        const challengerUserId = dispute.challengerId?._id || dispute.challengerId;

        if (currentOwnerUserId) {
          await Notification.create({
            userId: currentOwnerUserId,
            message: `Urgent: The handover for ${item.title} has been successfully disputed. Please return this item to the department immediately.`,
            type: 'handover_denied',
            priority: 'urgent',
            itemId: item._id,
            itemTitle: item.title,
            disputeId: dispute._id,
          });
        }

        if (challengerUserId) {
          await Notification.create({
            userId: challengerUserId,
            message: `Your Handover Dispute for ${item.title} has been approved. We have initiated a recall for the item. You will be notified when it is ready for pickup.`,
            type: 'dispute_resolved',
            priority: 'normal',
            itemId: item._id,
            itemTitle: item.title,
            disputeId: dispute._id,
          });
        }
      } catch (notifErr) {
        console.error('Notification creation error (resolveDispute):', notifErr);
      }
    }

    auditLogger.log({
      req,
      action: 'DISPUTE_RESOLVED',
      category: 'DISPUTE',
      severity: action === 'approve' ? 'WARNING' : 'INFO',
      outcome: 'SUCCESS',
      statusCode: 200,
      targetType: 'Dispute',
      targetId: dispute._id,
      metadata: { action, itemId: item._id, adminNotes: adminNotes ? adminNotes.trim() : null },
    });

    return res.json({
      message:
        action === 'approve'
          ? 'Dispute approved and item recall initiated'
          : 'Dispute rejected successfully',
      dispute,
      item,
    });
  } catch (error) {
    console.error('resolveDispute error:', error);
    return res.status(500).json({
      message: 'Server error resolving dispute',
      error: error.message,
    });
  }
};

const confirmReturn = async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Valid dispute ID is required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispute = await Dispute.findById(id)
      .populate('itemId', 'title image_url category location custodyStatus isDisputed status')
      .populate('challengerId', 'name email')
      .populate('currentOwnerId', 'name email')
      .session(session);

    if (!dispute) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Dispute not found' });
    }

    if (dispute.status !== 'recall_pending') {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Only disputes in 'recall_pending' status can be confirmed as returned. Current status is '${dispute.status}'.`,
      });
    }

    const item = await Item.findById(dispute.itemId?._id || dispute.itemId).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Associated item not found' });
    }

    dispute.status = 'resolved';
    item.custodyStatus = 'ready_for_pickup';
    item.isDisputed = false;

    await dispute.save({ session });
    await item.save({ session });

    const actorName = req.user?.name || req.admin?.email || 'Administrator';
    const actorEmail = req.user?.email || req.admin?.email || 'admin@system.local';

    // Notification for challenger using session
    const challengerUserId = dispute.challengerId?._id || dispute.challengerId;
    if (challengerUserId) {
      await Notification.create([
        {
          userId: challengerUserId,
          message: 'Your item has been recovered and is ready for pickup.',
          type: 'item_recovered',
          priority: 'high',
          itemId: item._id,
          itemTitle: item.title,
          disputeId: dispute._id,
        }
      ], { session });
    }

    // Log Activity using session
    await Activity.create([
      {
        type: 'item_recovered',
        message: `Item "${item.title}" recovered from previous owner and is now ready for pickup by challenger.`,
        actorName,
        actorEmail,
        itemTitle: item.title,
        itemId: item._id,
        userId: dispute.challengerId?._id || null,
        metadata: {
          disputeId: dispute._id,
          challengerId: dispute.challengerId?._id || null,
          currentOwnerId: dispute.currentOwnerId?._id || null,
        },
      }
    ], { session });

    await session.commitTransaction();

    return res.json({
      message: 'Item return confirmed successfully. Item is now ready for pickup.',
      dispute,
      item,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('confirmReturn error:', error);
    return res.status(500).json({
      message: 'Server error confirming return',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  submitDispute,
  getAllDisputes,
  resolveDispute,
  confirmReturn,
};
