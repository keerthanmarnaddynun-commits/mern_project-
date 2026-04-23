const registerUser = async (req, res) => {
  try {
    res.status(201).json({ message: 'User registered' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email } = req.body || {};
    res.status(200).json({
      token: 'mock-jwt-token',
      user: { _id: '507f1f77bcf86cd799439011', name: 'Test User', email: email || 'test@test.com' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
};