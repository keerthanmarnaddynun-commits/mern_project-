const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email } = req.body;

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
      user.email = email;
    }

    if (name) {
      user.name = name;
    }

    const updatedUser = await user.save();
    
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Delete user's claims
    await Claim.deleteMany({ claimant: userId });

    // 2. Find all items posted by user
    const userItems = await Item.find({ postedBy: userId });
    const userItemIds = userItems.map(item => item._id);

    // 3. Delete claims related to user's reported items
    if (userItemIds.length > 0) {
      await Claim.deleteMany({
        $or: [
          { itemId: { $in: userItemIds } },
          { lostItemId: { $in: userItemIds } }
        ]
      });
    }

    // 4. Delete user's reported items
    await Item.deleteMany({ postedBy: userId });

    // 5. Delete user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  deleteProfile,
};
