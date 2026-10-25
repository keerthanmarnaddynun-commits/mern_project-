const mongoose = require('mongoose');
const Item = require('../models/Item');
const Activity = require('../models/Activity');
const Dispute = require('../models/Dispute');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const { matchOppositePendingSameCategory, confidenceRank } = require('../utils/itemSimilarity');
const { extractKeyword } = require('../utils/titleKeyword');

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const getItems = async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {
      status: { $ne: 'resolved' },
      is_resolved: { $ne: true },
      isHidden: { $ne: true },
      custodyStatus: { $ne: 'rejected' },
    };

    if (status) {
      query.type = status;
    }

    const items = await Item.find(query).sort({ createdAt: -1 }).limit(100);
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getMyReports = async (req, res) => {
  try {
    const items = await Item.find({ postedBy: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAllItems = getItems;

const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    const itemObj = item.toObject();
    if (
      item.custodyStatus === 'ready_for_pickup' ||
      item.custodyStatus === 'recall_pending' ||
      item.isDisputed
    ) {
      const dispute = await Dispute.findOne({
        itemId: item._id,
        status: { $in: ['resolved', 'ready_for_pickup', 'recall_pending', 'pending'] },
      })
        .populate('challengerId', 'name email')
        .populate('currentOwnerId', 'name email')
        .sort({ updatedAt: -1 });

      if (dispute) {
        itemObj.dispute = dispute;
      }
    }
    res.status(200).json(itemObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createItem = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      type,
      location,
      date_occurred,
      image_url,
      contact_email,
      contact_phone,
      custodyLocation,
      custodyDepartment,
      receiverName,
      receiverRole,
      handoverNotes,
    } = req.body;

    if (!title || !description || !category || !type || !location || !date_occurred || !contact_email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const postedBy = req.user._id;
    const normalizedCustodyLocation = normalizeText(custodyLocation);
    const normalizedCustodyDepartment = normalizeText(custodyDepartment);
    const normalizedReceiverName = normalizeText(receiverName);
    const normalizedReceiverRole = normalizeText(receiverRole);
    const normalizedHandoverNotes = normalizeText(handoverNotes);
    const isCustodyProvided = Boolean(
      custodyDepartment ||
      req.body.custodyDepartment ||
      custodyLocation ||
      req.body.custodyLocation ||
      normalizedCustodyDepartment ||
      normalizedCustodyLocation
    );

    const resolvedImageUrl = req.file ? `/uploads/${req.file.filename}` : (image_url || null);

    const newItem = new Item({
      title,
      description,
      category,
      type,
      location,
      date_occurred,
      image_url: resolvedImageUrl,
      contact_email,
      contact_phone: contact_phone || null,
      postedBy,
      status: 'pending', // Initialize with pending status
      is_resolved: false,
      custodyStatus: (custodyDepartment || req.body.custodyDepartment || isCustodyProvided)
        ? 'awaiting_confirmation'
        : 'not_handed_over',
      custodyDepartment: normalizedCustodyDepartment || normalizeText(req.body.custodyDepartment) || null,
      custodyLocation: normalizedCustodyLocation || normalizeText(req.body.custodyLocation) || null,
      receiverName: normalizedReceiverName || normalizeText(req.body.receiverName) || null,
      receiverRole: normalizedReceiverRole || normalizeText(req.body.receiverRole) || null,
      handoverNotes: normalizedHandoverNotes || normalizeText(req.body.handoverNotes) || null,
      handoverDate: isCustodyProvided ? new Date() : null,
    });

    if (req.body.custodyDepartment || req.body.custodyLocation) {
      newItem.custodyStatus = 'awaiting_confirmation';
      if (!newItem.custodyDepartment && normalizedCustodyDepartment) {
        newItem.custodyDepartment = normalizedCustodyDepartment;
      }
      if (!newItem.custodyLocation && normalizedCustodyLocation) {
        newItem.custodyLocation = normalizedCustodyLocation;
      }
      if (!newItem.receiverName && normalizedReceiverName) {
        newItem.receiverName = normalizedReceiverName;
      }
      if (!newItem.receiverRole && normalizedReceiverRole) {
        newItem.receiverRole = normalizedReceiverRole;
      }
      if (!newItem.handoverNotes && normalizedHandoverNotes) {
        newItem.handoverNotes = normalizedHandoverNotes;
      }
      if (!newItem.handoverDate) {
        newItem.handoverDate = new Date();
      }
    }

    await newItem.save();

    try {
      await Activity.create({
        type: 'item_reported',
        message: `User reported a ${newItem.type} item: "${newItem.title}"`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: newItem.title,
        itemId: newItem._id,
        userId: req.user._id,
        metadata: {
          category: newItem.category,
          itemType: newItem.type,
          keyword: extractKeyword(newItem.title),
          ...(newItem.type === 'found' && (newItem.custodyLocation || newItem.custodyDepartment)
            ? {
                custodyStatus: newItem.custodyStatus,
                custodyDepartment: newItem.custodyDepartment,
                custodyLocation: newItem.custodyLocation,
              }
            : {}),
        }
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr);
    }

    res.status(201).json(newItem);
  } catch (error) {
    console.error("CREATE ITEM ERROR:", error);
    res.status(400).json({ message: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedUpdates = [
      'title',
      'description',
      'category',
      'location',
      'date_occurred',
      'image_url',
      'contact_email',
      'contact_phone',
      'custodyLocation',
      'custodyDepartment',
      'receiverName',
      'receiverRole',
      'handoverNotes',
    ];

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const isOwner =
      (item.postedBy && item.postedBy.toString() === req.user._id.toString()) ||
      (item.reporter && item.reporter.toString() === req.user._id.toString());
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this record' });
    }

    let isModified = false;
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (
          item.type === 'found' ||
          !['custodyLocation', 'custodyDepartment', 'receiverName', 'receiverRole', 'handoverNotes'].includes(field)
        ) {
          if (['custodyLocation', 'custodyDepartment', 'receiverName', 'receiverRole', 'handoverNotes'].includes(field)) {
            item[field] = normalizeText(req.body[field]);
          } else {
            item[field] = req.body[field];
          }
          isModified = true;
        }
      }
    });

    if (item.type === 'found') {
      const hasCustodyInfo = !!(item.custodyLocation || item.custodyDepartment);
      if (hasCustodyInfo) {
        item.custodyStatus = item.status === 'resolved' || item.is_resolved ? 'returned' : (item.custodyStatus === 'department_received' ? 'department_received' : 'awaiting_confirmation');
        if (!item.handoverDate) {
          item.handoverDate = new Date();
        }
      } else if (item.status === 'resolved' || item.is_resolved) {
        item.custodyStatus = 'returned';
      } else {
        item.custodyStatus = 'not_handed_over';
        item.handoverDate = null;
      }
      isModified = true;
    }

    if (isModified) {
      await item.save();
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const isOwner =
      (item.postedBy && item.postedBy.toString() === req.user._id.toString()) ||
      (item.reporter && item.reporter.toString() === req.user._id.toString());
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this record' });
    }

    await item.deleteOne();

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getSimilarItems = async (req, res) => {
  try {
    const { id } = req.params;
    let current;
    try {
      current = await Item.findById(id);
    } catch {
      return res.status(400).json({ message: 'Invalid item id' });
    }
    if (!current) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const oppositeType = current.type === 'lost' ? 'found' : 'lost';

    // Hierarchy: opposite type + pending + exact same category only (no cross-category)
    const candidates = await Item.find({
      type: oppositeType,
      status: 'pending',
      category: current.category,
      _id: { $ne: current._id },
    }).lean();

    const matches = [];

    for (const cand of candidates) {
      const m = matchOppositePendingSameCategory(current, cand);
      if (!m) continue;
      matches.push({ item: cand, confidence: m.confidence, reasons: m.reasons });
    }

    matches.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));
    const top = matches.slice(0, 5);

    return res.status(200).json({
      currentItem: current.toObject(),
      matches: top,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const confirmItemReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Only faculty members can confirm item receipt' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.custodyStatus = 'department_received';
    await item.save();

    try {
      await Activity.create({
        type: 'item_verified',
        message: `The department has physically received and verified your reported item: ${item.title}.`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: item.title,
        itemId: item._id,
        userId: item.postedBy,
      });
    } catch (actErr) {
      console.error('Failed to log item_verified activity:', actErr);
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const denyItemReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || req.user.role !== 'faculty') {
      return res.status(403).json({ message: 'Only faculty members can deny item receipt' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.custodyStatus = 'rejected';

    await item.save();

    try {
      await Activity.create({
        type: 'handover_denied',
        message: `Handover denied for your reported item: ${item.title}.`,
        actorName: req.user.name,
        itemTitle: item.title,
        itemId: item._id,
        userId: item.postedBy,
      });
    } catch (actErr) {
      console.error('Failed to log handover_denied activity:', actErr);
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const disputeItemHandover = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, proofUrl } = req.body;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.status !== 'resolved' || item.custodyStatus !== 'returned') {
      return res.status(400).json({
        message: 'Only resolved and returned items can be disputed.',
      });
    }

    const approvedClaim = await Claim.findOne({
      itemId: item._id,
      status: 'approved',
    });

    const currentOwnerId = approvedClaim?.claimant || item.postedBy;

    // Check or create Dispute document to ensure MongoDB disputes collection is populated
    let dispute = await Dispute.findOne({
      itemId: item._id,
      challengerId: req.user._id,
      status: 'pending',
    });

    if (!dispute) {
      dispute = new Dispute({
        itemId: item._id,
        challengerId: req.user._id,
        currentOwnerId,
        reason: (reason || 'Handover contested by user').trim(),
        proofUrl: proofUrl ? proofUrl.trim() : null,
        status: 'pending',
        adminNotes: null,
      });
      await dispute.save();
    }

    item.isDisputed = true;
    item.disputeReason = reason || null;
    item.disputeProofUrl = proofUrl || null;

    await item.save();

    try {
      await Activity.create({
        type: 'dispute_raised',
        message: `Dispute raised on returned item "${item.title}": ${reason || 'Handover contested by user'}`,
        actorName: req.user.name,
        actorEmail: req.user.email,
        itemTitle: item.title,
        itemId: item._id,
        userId: req.user._id,
        metadata: {
          disputeId: dispute._id,
          category: item.category,
          keyword: extractKeyword(item.title),
          reason: reason || null,
          proofUrl: proofUrl || null,
        },
      });
    } catch (logErr) {
      console.error('Activity log error (disputeItemHandover):', logErr);
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const handoverItem = async (req, res) => {
  const { id } = req.params;
  const { challengerId, recipientId, verificationMethod, verificationNotes } = req.body || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Valid item ID is required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const item = await Item.findById(id).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Item not found' });
    }

    const actorName = req.user?.name || req.admin?.email || 'Administrator';
    const actorEmail = req.user?.email || req.admin?.email || 'admin@system.local';

    if (item.custodyStatus === 'ready_for_pickup') {
      // 1. Database Cleanup: Query Dispute for the resolved dispute linked to this itemId
      const dispute = await Dispute.findOne({
        itemId: item._id,
        status: { $in: ['resolved', 'ready_for_pickup'] },
      }).sort({ updatedAt: -1 }).session(session);

      const finalChallengerId = challengerId || recipientId || dispute?.challengerId;
      const originalOwnerId = dispute?.currentOwnerId;

      // 2. Find original incorrect claim and revoke it
      let incorrectClaim = null;
      if (originalOwnerId) {
        incorrectClaim = await Claim.findOne({
          itemId: item._id,
          claimant: originalOwnerId,
        }).session(session);
      }
      if (!incorrectClaim) {
        incorrectClaim = await Claim.findOne({
          itemId: item._id,
          status: 'approved',
        }).session(session);
      }

      if (incorrectClaim) {
        incorrectClaim.status = 'revoked';
        incorrectClaim.reason = 'Claim revoked following dispute resolution and handover to rightful owner.';
        await incorrectClaim.save({ session });
      }

      // 3. Find challenger's claim and approve it
      let challengerClaim = null;
      if (finalChallengerId) {
        challengerClaim = await Claim.findOne({
          itemId: item._id,
          claimant: finalChallengerId,
        }).session(session);
      }

      if (challengerClaim) {
        challengerClaim.status = 'approved';
        if (verificationMethod) {
          challengerClaim.verificationMethod = verificationMethod.toString().trim();
        }
        if (verificationNotes) {
          challengerClaim.verificationNotes = verificationNotes.toString().trim();
        }
        await challengerClaim.save({ session });

        if (challengerClaim.lostItemId) {
          await Item.findByIdAndUpdate(challengerClaim.lostItemId, {
            status: 'resolved',
            is_resolved: true,
          }, { session });
        }
      }

      // 4. Set item custodyStatus = 'returned'
      item.custodyStatus = 'returned';
      item.status = 'resolved';
      item.is_resolved = true;
      item.handoverDate = new Date();
      if (verificationNotes) {
        item.handoverNotes = verificationNotes.toString().trim();
      }
      await item.save({ session });

      // 5. Log Activity using session
      await Activity.create([
        {
          type: 'handover_completed',
          message: `Final handover completed for item "${item.title}". Handed over to rightful owner after dispute resolution.`,
          actorName,
          actorEmail,
          itemTitle: item.title,
          itemId: item._id,
          claimId: challengerClaim?._id || null,
          userId: finalChallengerId || null,
          metadata: {
            disputeId: dispute?._id || null,
            challengerId: finalChallengerId || null,
            revokedClaimOwnerId: originalOwnerId || null,
            custodyStatus: 'returned',
            verificationMethod: verificationMethod || null,
            verificationNotes: verificationNotes || null,
          },
        }
      ], { session });

      // 6. Notification for challenger using session
      if (finalChallengerId) {
        await Notification.create([
          {
            userId: finalChallengerId,
            message: `Your recovered item "${item.title}" has been successfully handed over to you.`,
            type: 'handover_completed',
            priority: 'high',
            itemId: item._id,
            itemTitle: item.title,
          }
        ], { session });
      }

      await session.commitTransaction();

      return res.status(200).json({
        message: 'Recovered item successfully handed over to rightful owner.',
        item,
        approvedClaim: challengerClaim,
        revokedClaim: incorrectClaim,
      });
    }

    // Standard handover logic for items that are just pending and have never been disputed
    item.custodyStatus = 'returned';
    item.status = 'resolved';
    item.is_resolved = true;
    item.handoverDate = new Date();
    if (verificationNotes) {
      item.handoverNotes = verificationNotes.toString().trim();
    }
    await item.save({ session });

    await Activity.create([
      {
        type: 'handover_completed',
        message: `Handover completed for item "${item.title}".`,
        actorName,
        actorEmail,
        itemTitle: item.title,
        itemId: item._id,
        userId: req.user?._id || null,
      }
    ], { session });

    await session.commitTransaction();

    return res.status(200).json({
      message: 'Item handover completed successfully.',
      item,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('handoverItem error:', error);
    return res.status(500).json({ message: 'Server error processing handover', error: error.message });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getItems,
  getMyReports,
  getItemById,
  getSimilarItems,
  createItem,
  updateItem,
  deleteItem,
  confirmItemReceipt,
  denyItemReceipt,
  disputeItemHandover,
  handoverItem,
  getAllItems,
};
