const Item = require('../models/Item');

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
    const { title, description, category, type, location, date_occurred, image_url, contact_email, contact_phone, postedBy } = req.body;

    if (!title || !description || !category || !type || !location || !date_occurred || !contact_email || !postedBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

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

    const item = await Item.findByIdAndUpdate(
      id,
      { status, is_resolved: status === 'resolved' },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
};
