const mongoose = require('mongoose');
const Item = require('../models/Item');
const Activity = require('../models/Activity');
const Dispute = require('../models/Dispute');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const auditLogger = require('../utils/auditLogger');
const { matchOppositePendingSameCategory, confidenceRank } = require('../utils/itemSimilarity');
const { extractKeyword } = require('../utils/titleKeyword');

const PUBLIC_ITEM_FIELDS =
  '_id title description category type location date_occurred image_url status createdAt postedBy custodyStatus is_resolved isDisputed';

const PRIVATE_ITEM_FIELDS = [
  'contact_email',
  'contact_phone',
  'handoverNotes',
  'receiverName',
  'receiverRole',
  'disputeReason',
  'disputeProofUrl',
];

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickPublicItem(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const allowed = PUBLIC_ITEM_FIELDS.split(/\s+/).filter(Boolean);
  const projected = {};
  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(obj, field)) {
      projected[field] = obj[field];
    }
  });
  return projected;
}

function isItemOwner(item, user) {
  if (!item || !user || !user._id) return false;
  const postedBy = item.postedBy && item.postedBy._id ? item.postedBy._id : item.postedBy;
  return postedBy && postedBy.toString() === user._id.toString();
}

function canViewItemPii(req, item) {
  const role = req.user?.role || req.admin?.role;
  if (role === 'admin') return true;
  return isItemOwner(item, req.user);
}

function canViewItemDispute(req, item) {
  const role = req.user?.role || req.admin?.role;
  if (role === 'admin' || role === 'faculty') return true;
  return isItemOwner(item, req.user);
}

const ALLOWED_SORT_FIELDS = ['createdAt', 'date_occurred', 'title', 'category'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function escapeRegex(str) {
  return typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
}

const getItems = async (req, res) => {
  try {
    const { status, type, category, search, sortBy, sortOrder, order, page, limit } = req.query || {};
    
    const query = {
      status: { $ne: 'resolved' },
      is_resolved: { $ne: true },
      isHidden: { $ne: true },
      custodyStatus: { $ne: 'rejected' },
    };

    const itemType = typeof type === 'string' ? type : typeof status === 'string' ? status : null;
    if (itemType && ['lost', 'found'].includes(itemType.toLowerCase())) {
      query.type = itemType.toLowerCase();
    }

    if (category && typeof category === 'string' && category.trim()) {
      query.category = category.trim();
    }

    if (search && typeof search === 'string' && search.trim()) {
      const sanitizedSearch = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: sanitizedSearch, $options: 'i' } },
        { description: { $regex: sanitizedSearch, $options: 'i' } },
        { location: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    // Whitelist sort fields and strict direction
    const sortField = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    const directionStr = String(sortOrder || order || '').toLowerCase();
    const sortDirection = (directionStr === 'asc' || directionStr === '1' || sortOrder === 1) ? 1 : -1;
    const sortOptions = { [sortField]: sortDirection };

    // Enforce pagination limits
    const parsedLimit = parseInt(limit, 10);
    const paginationLimit = (!isNaN(parsedLimit) && parsedLimit > 0)
      ? Math.min(parsedLimit, MAX_LIMIT)
      : (limit !== undefined ? DEFAULT_LIMIT : 100);

    const parsedPage = parseInt(page, 10);
    const paginationPage = (!isNaN(parsedPage) && parsedPage > 0) ? parsedPage : 1;
    const skip = (paginationPage - 1) * paginationLimit;

    const items = await Item.find(query)
      .select(PUBLIC_ITEM_FIELDS)
      .sort(sortOptions)
      .skip(skip)
      .limit(paginationLimit);

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyReports = async (req, res) => {
  try {
    const items = await Item.find({ postedBy: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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

    const privileged = canViewItemPii(req, item);
    const itemObj = privileged ? item.toObject() : pickPublicItem(item);

    if (!privileged) {
      PRIVATE_ITEM_FIELDS.forEach((field) => {
        delete itemObj[field];
      });
    }

    if (
      canViewItemDispute(req, item) &&
      (item.custodyStatus === 'ready_for_pickup' ||
        item.custodyStatus === 'recall_pending' ||
        item.isDisputed)
    ) {
      const isAdmin = (req.user?.role || req.admin?.role) === 'admin';
      const userSelect = isAdmin ? 'name email' : 'name';
      const dispute = await Dispute.findOne({
        itemId: item._id,
        status: { $in: ['resolved', 'ready_for_pickup', 'recall_pending', 'pending'] },
      })
        .select(isAdmin ? 'status reason proofUrl adminNotes challengerId currentOwnerId itemId' : 'status reason challengerId currentOwnerId itemId')
        .populate('challengerId', userSelect)
        .populate('currentOwnerId', userSelect)
        .sort({ updatedAt: -1 });

      if (dispute) {
        itemObj.dispute = dispute;
      }
    }

    res.status(200).json(itemObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const ALLOWED_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Accessories',
  'Documents',
  'Keys',
  'Wallet / Purse',
  'Bag / Backpack',
  'Jewelry',
  'Pets',
  'Other',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateItemFields(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Invalid request body' };
  }

  if (!partial) {
    if (
      !body.title ||
      !body.description ||
      !body.category ||
      !body.type ||
      !body.location ||
      !body.date_occurred ||
      !body.contact_email
    ) {
      return { valid: false, message: 'Missing required fields' };
    }
  }

  // category
  if (!partial || body.category !== undefined) {
    if (typeof body.category !== 'string') {
      return { valid: false, message: 'Category must be a string' };
    }
    const trimmedCategory = body.category.trim();
    if (!ALLOWED_CATEGORIES.includes(trimmedCategory)) {
      return { valid: false, message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}` };
    }
  }

  // type (create only: lost or found)
  if (!partial) {
    if (typeof body.type !== 'string') {
      return { valid: false, message: 'Type must be a string' };
    }
    const trimmedType = body.type.trim();
    if (trimmedType !== 'lost' && trimmedType !== 'found') {
      return { valid: false, message: 'Type must be either lost or found' };
    }
  }

  // title: 1-100 chars
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return { valid: false, message: 'Title must be a string' };
    }
    const trimmedTitle = body.title.trim();
    if (trimmedTitle.length < 1 || trimmedTitle.length > 100) {
      return { valid: false, message: 'Title must be between 1 and 100 characters' };
    }
  }

  // description: 1-2000 chars
  if (!partial || body.description !== undefined) {
    if (typeof body.description !== 'string') {
      return { valid: false, message: 'Description must be a string' };
    }
    const trimmedDesc = body.description.trim();
    if (trimmedDesc.length < 1 || trimmedDesc.length > 2000) {
      return { valid: false, message: 'Description must be between 1 and 2000 characters' };
    }
  }

  // location: 1-200 chars
  if (!partial || body.location !== undefined) {
    if (typeof body.location !== 'string') {
      return { valid: false, message: 'Location must be a string' };
    }
    const trimmedLoc = body.location.trim();
    if (trimmedLoc.length < 1 || trimmedLoc.length > 200) {
      return { valid: false, message: 'Location must be between 1 and 200 characters' };
    }
  }

  // contact_email: matches ^[^\s@]+@[^\s@]+\.[^\s@]+$ and max 254 chars
  if (!partial || body.contact_email !== undefined) {
    if (typeof body.contact_email !== 'string') {
      return { valid: false, message: 'Contact email must be a string' };
    }
    const trimmedEmail = body.contact_email.trim();
    if (trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
      return { valid: false, message: 'Contact email must be a valid email address with max 254 characters' };
    }
  }

  // contact_phone: optional, max 30
  if (body.contact_phone !== undefined && body.contact_phone !== null) {
    if (typeof body.contact_phone !== 'string') {
      return { valid: false, message: 'Contact phone must be a string' };
    }
    const trimmedPhone = body.contact_phone.trim();
    if (trimmedPhone.length > 30) {
      return { valid: false, message: 'Contact phone cannot exceed 30 characters' };
    }
  }

  // custodyLocation, custodyDepartment, receiverName, receiverRole: optional, max 200
  const opt200 = ['custodyLocation', 'custodyDepartment', 'receiverName', 'receiverRole'];
  for (const field of opt200) {
    if (body[field] !== undefined && body[field] !== null) {
      if (typeof body[field] !== 'string') {
        return { valid: false, message: `${field} must be a string` };
      }
      if (body[field].trim().length > 200) {
        return { valid: false, message: `${field} cannot exceed 200 characters` };
      }
    }
  }

  // handoverNotes: optional, max 1000
  if (body.handoverNotes !== undefined && body.handoverNotes !== null) {
    if (typeof body.handoverNotes !== 'string') {
      return { valid: false, message: 'handoverNotes must be a string' };
    }
    if (body.handoverNotes.trim().length > 1000) {
      return { valid: false, message: 'handoverNotes cannot exceed 1000 characters' };
    }
  }

  // date_occurred: format YYYY-MM-DD, a real calendar date, not later than server date + 1 day
  if (!partial || body.date_occurred !== undefined) {
    if (typeof body.date_occurred !== 'string') {
      return { valid: false, message: 'Date occurred must be a string in YYYY-MM-DD format' };
    }
    const rawDate = body.date_occurred.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
    if (!match) {
      return { valid: false, message: 'Date occurred must be in YYYY-MM-DD format' };
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return { valid: false, message: 'Date occurred must be a real calendar date' };
    }
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 1);
    maxDate.setHours(23, 59, 59, 999);
    if (d.getTime() > maxDate.getTime()) {
      return { valid: false, message: 'Date occurred cannot be later than server date + 1 day' };
    }
  }

  return { valid: true };
}

const createItem = async (req, res) => {
  try {
    const validation = validateItemFields(req.body, { partial: false });
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

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

    if (newItem.custodyLocation) {
      newItem.custodyDepartment = newItem.custodyLocation;
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

    auditLogger.log({
      req,
      actorId: req.user._id,
      action: 'ITEM_CREATED',
      category: 'ITEM',
      severity: 'INFO',
      outcome: 'SUCCESS',
      statusCode: 201,
      targetType: 'Item',
      targetId: newItem._id,
      metadata: { title: newItem.title, category: newItem.category, type: newItem.type },
    });

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

    const validation = validateItemFields(req.body, { partial: true });
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
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

    if (item.custodyLocation) {
      item.custodyDepartment = item.custodyLocation;
    }

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

    auditLogger.log({
      req,
      actorId: req.user._id,
      action: 'ITEM_UPDATED',
      category: 'ITEM',
      severity: 'INFO',
      outcome: 'SUCCESS',
      statusCode: 200,
      targetType: 'Item',
      targetId: item._id,
      metadata: { title: item.title, id: item._id },
    });

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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

    const isAdmin = req.user.role === 'admin';
    auditLogger.log({
      req,
      actorId: req.user._id,
      action: isAdmin ? 'ADMIN_FORCE_DELETE_ITEM' : 'ITEM_DELETED',
      category: isAdmin ? 'ADMIN' : 'ITEM',
      severity: isAdmin ? 'CRITICAL' : 'INFO',
      outcome: 'SUCCESS',
      statusCode: 200,
      targetType: 'Item',
      targetId: item._id,
      metadata: { title: item.title, id: item._id, forcedByAdmin: isAdmin },
    });

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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
    })
      .select(PUBLIC_ITEM_FIELDS)
      .lean();

    const matches = [];

    for (const cand of candidates) {
      const m = matchOppositePendingSameCategory(current, cand);
      if (!m) continue;
      matches.push({ item: pickPublicItem(cand), confidence: m.confidence, reasons: m.reasons });
    }

    matches.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));
    const top = matches.slice(0, 5);

    const currentPayload = canViewItemPii(req, current)
      ? current.toObject()
      : pickPublicItem(current);

    return res.status(200).json({
      currentItem: currentPayload,
      matches: top,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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
    res.status(500).json({ message: 'Server error' });
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
    res.status(500).json({ message: 'Server error' });
  }
};

const disputeItemHandover = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, proofUrl } = req.body;

    if (reason && (typeof reason !== 'string' || reason.trim().length > 1000)) {
      return res.status(400).json({ message: 'Dispute reason cannot exceed 1000 characters' });
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
        proofUrl: normalizedProofUrl,
        status: 'pending',
        adminNotes: null,
      });
      await dispute.save();
    }

    item.isDisputed = true;
    item.disputeReason = reason || null;
    item.disputeProofUrl = normalizedProofUrl;

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
          proofUrl: normalizedProofUrl,
        },
      });
    } catch (logErr) {
      console.error('Activity log error (disputeItemHandover):', logErr);
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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

    auditLogger.log({
      req,
      action: 'ITEM_HANDOVER_COMPLETED',
      category: 'ITEM',
      severity: 'INFO',
      outcome: 'SUCCESS',
      statusCode: 200,
      targetType: 'Item',
      targetId: item._id,
      metadata: { title: item.title, id: item._id },
    });

    return res.status(200).json({
      message: 'Item handover completed successfully.',
      item,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('handoverItem error:', error);
    return res.status(500).json({ message: 'Server error processing handover' });
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
