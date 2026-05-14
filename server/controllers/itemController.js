const Item = require('../models/Item');

/**
 * Generic / low-signal tokens only — do NOT include real product identifiers
 * (iphone, laptop, dell, hp, wallet, keys, charger, etc.)
 */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one', 'our', 'out', 'day',
  'get', 'has', 'him', 'his', 'how', 'its', 'let', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'did',
  'she', 'use', 'had', 'been', 'from', 'with', 'that', 'this', 'have', 'will', 'your', 'what', 'when', 'them',
  'they', 'than', 'then', 'here', 'there', 'where', 'which', 'while', 'would', 'could', 'should', 'about', 'after',
  'before', 'above', 'below', 'into', 'onto', 'once', 'only', 'both', 'each', 'more', 'most', 'some', 'such',
  'very', 'just', 'also', 'back', 'even', 'much', 'same', 'other', 'help', 'please', 'looking', 'someone', 'anyone',
  'lost', 'found', 'item', 'items', 'thing', 'things', 'object', 'objects', 'near', 'around', 'campus', 'college',
]);

function tokenize(text) {
  if (!text || typeof text !== 'string') return new Set();
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

function intersectionWords(setA, setB) {
  const out = [];
  for (const w of setA) {
    if (setB.has(w)) out.push(w);
  }
  return out;
}

function confidenceRank(confidence) {
  if (confidence === 'Extremely Strong Match') return 3;
  if (confidence === 'Very Strong Match') return 2;
  return 1;
}

const getItems = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { type: status } : {};
    const items = await Item.find(query).sort({ createdAt: -1 });
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
    const { title, description, category, type, location, date_occurred, image_url, contact_email, contact_phone } =
      req.body;

    if (!title || !description || !category || !type || !location || !date_occurred || !contact_email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const postedBy = req.user._id;

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
    });

    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    console.error("CREATE ITEM ERROR:", error);
    res.status(400).json({ message: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status field is required' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    item.status = status;
    item.is_resolved = status === 'resolved';
    await item.save();

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

    const curTitleTok = tokenize(current.title);
    const curDescTok = tokenize(current.description);
    const curLocTok = tokenize(current.location);

    const matches = [];

    for (const cand of candidates) {
      const candTitleTok = tokenize(cand.title);
      const titleOverlap = intersectionWords(curTitleTok, candTitleTok);

      // Mandatory: at least one meaningful title keyword in common
      if (titleOverlap.length === 0) {
        continue;
      }

      const descOverlap = intersectionWords(curDescTok, tokenize(cand.description));
      const locOverlap = intersectionWords(curLocTok, tokenize(cand.location));
      const hasDesc = descOverlap.length > 0;
      const hasLoc = locOverlap.length > 0;

      let confidence;
      if (hasLoc && hasDesc) {
        confidence = 'Extremely Strong Match';
      } else if (hasLoc || hasDesc) {
        confidence = 'Very Strong Match';
      } else {
        confidence = 'Strong Match';
      }

      const reasons = [];
      reasons.push(`Same category: ${current.category}`);
      reasons.push(`Title keyword overlap: ${titleOverlap.join(', ')}`);
      if (hasLoc) {
        reasons.push(`Location keyword overlap: ${locOverlap.join(', ')}`);
      }
      if (hasDesc) {
        reasons.push(`Description keyword overlap: ${descOverlap.join(', ')}`);
      }
      reasons.push(`Confidence: ${confidence}`);

      matches.push({ item: cand, confidence, reasons });
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
  getItemById,
  getSimilarItems,
  createItem,
  updateItem,
  deleteItem,
};
