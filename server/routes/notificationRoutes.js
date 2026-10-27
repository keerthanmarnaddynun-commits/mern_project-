const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const Notification = require('../models/Notification');

// GET /api/notifications - Get current user's notifications
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.json([]);
    }

    const notifications = await Notification.find({ userId })
      .populate('itemId', 'title image_url category custodyStatus')
      .populate('disputeId', 'status reason')
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json(notifications);
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    return res.status(500).json({
      message: 'Server error fetching notifications',
      error: error.message,
    });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', protect, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    return res.status(500).json({
      message: 'Server error updating notification',
      error: error.message,
    });
  }
});

module.exports = router;
