const Item = require('../models/Item');
const Activity = require('../models/Activity');
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
    
    // Public browse/list should only show active items
    const query = {
      status: { $ne: 'resolved' },
      is_resolved: { $ne: true }
    };

    if (status) {
      query.type = status;
    }

    const items = await Item.find(query).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getMyReports = async (req, res) => {
  try {
    const items = await Item.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.status(200).json(item);
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
    const shouldMarkDepartmentReceived =
      type === 'found' && (normalizedCustodyLocation || normalizedCustodyDepartment);

    const newItem = new Item({
      title,
      description,
      category,
      type,
      location,
      date_occurred,
      image_url: image_url || null,
      contact_email,
      contact_phone: contact_phone || null,
      postedBy,
      status: 'pending', // Initialize with pending status
      is_resolved: false,
      custodyStatus: shouldMarkDepartmentReceived ? 'department_received' : 'not_handed_over',
      custodyLocation: type === 'found' ? normalizedCustodyLocation : null,
      custodyDepartment: type === 'found' ? normalizedCustodyDepartment : null,
      receiverName: type === 'found' ? normalizedReceiverName : null,
      receiverRole: type === 'found' ? normalizedReceiverRole : null,
      handoverNotes: type === 'found' ? normalizedHandoverNotes : null,
      handoverDate: shouldMarkDepartmentReceived ? new Date() : null,
    });

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

    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
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
        item.custodyStatus = item.status === 'resolved' || item.is_resolved ? 'returned' : 'department_received';
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

    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
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

module.exports = {
  getItems,
  getMyReports,
  getItemById,
  getSimilarItems,
  createItem,
  updateItem,
  deleteItem,
};
