const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim() === '') {
    const err = new Error(
      'JWT_SECRET is not configured. Add JWT_SECRET to your server .env file (a long random string).'
    );
    err.code = 'JWT_SECRET_MISSING';
    throw err;
  }
  return secret;
}

function signToken(userId) {
  return jwt.sign({ userId: String(userId) }, getJwtSecret(), { expiresIn: '7d' });
}

function toPublicUser(userDoc) {
  return {
    _id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
  };
}

const registerUser = async (req, res) => {
  try {
    getJwtSecret();
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ message: e.message });
  }

  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      return res.status(409).json({ message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: String(name).trim(),
      email: emailNorm,
      password: hashedPassword,
    });

    const token = signToken(user._id);

    try {
      await Activity.create({
        type: 'user_registered',
        message: `New user registered: ${user.name} (${user.email})`,
        actorName: user.name,
        actorEmail: user.email,
        userId: user._id
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr);
    }

    return res.status(201).json({
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'User already exists with this email' });
    }
    console.error('registerUser:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const loginUser = async (req, res) => {
  try {
    getJwtSecret();
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ message: e.message });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const inputEmail = String(email).toLowerCase().trim();
    const inputPassword = String(password).trim();
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();

    if (inputEmail === adminEmail && inputPassword === adminPassword && adminEmail !== '') {
      const token = jwt.sign(
        { email: adminEmail, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      return res.status(200).json({
        token,
        admin: {
          email: adminEmail,
          role: 'admin'
        },
        isAdmin: true
      });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: emailNorm }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    return res.status(200).json({
      token,
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('loginUser:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
};
