const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { issueCsrfToken, clearCsrfCookie } = require('../middleware/csrf');
const { getJwtSecret, signToken } = require('../utils/jwt');
const {
  generateVerificationToken,
  hashToken,
  sendVerificationEmail,
} = require('../utils/email');

function toPublicUser(userDoc) {
  return {
    _id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    role: userDoc.role || 'user',
    department: userDoc.department || null,
    isVerified: Boolean(userDoc.isVerified),
  };
}

const validatePasswordComplexity = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
};

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

    if (!validatePasswordComplexity(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      return res.status(409).json({ message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { rawToken, hashedToken, expires } = generateVerificationToken();

    const user = await User.create({
      name: String(name).trim(),
      email: emailNorm,
      password: hashedPassword,
      isVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpires: expires,
    });

    const token = signToken(user);

    // Asynchronously send verification email (handled gracefully if provider is offline)
    sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    }).catch((mailErr) => {
      console.error('Registration verification email error:', mailErr?.message || mailErr);
    });

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

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const csrfToken = issueCsrfToken(res);

    return res.status(201).json({
      token,
      csrfToken,
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
      const token = signToken(
        { id: '000000000000000000000000', email: adminEmail, role: 'admin', tokenVersion: 0 },
        { expiresIn: '1d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      const csrfToken = issueCsrfToken(res);

      return res.status(200).json({
        token,
        csrfToken,
        admin: {
          email: adminEmail,
          role: 'admin'
        },
        isAdmin: true
      });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: emailNorm }).select('+password +tokenVersion');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const csrfToken = issueCsrfToken(res);

    return res.status(200).json({
      token,
      csrfToken,
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('loginUser:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const logoutUser = async (req, res) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (token) {
      let decoded = null;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        decoded = jwt.decode(token);
      }

      const userId = decoded?.id || decoded?.userId || req.user?._id;
      if (userId && userId !== '000000000000000000000000') {
        await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
      }
    } else if (req.user?._id && req.user._id !== '000000000000000000000000') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    }
  } catch (err) {
    console.error('logoutUser error:', err);
  } finally {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    clearCsrfCookie(res);
  }

  return res.status(200).json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no session found' });
    }
    const publicUser = toPublicUser(req.user);
    return res.status(200).json({
      user: publicUser,
      ...publicUser,
    });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ message: 'Server error retrieving current user' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const rawToken = req.query.token || req.body?.token;

    if (!rawToken || typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/i.test(rawToken.trim())) {
      return res.status(400).json({ message: 'Invalid or malformed verification token.' });
    }

    const hashedToken = hashToken(rawToken.trim());

    // Search for matching token in initial registration or pending email change
    const user = await User.findOne({
      $or: [
        { emailVerificationToken: hashedToken },
        { pendingEmailToken: hashedToken },
      ],
    }).select('+emailVerificationToken +emailVerificationTokenExpires +pendingEmailToken +pendingEmailTokenExpires +tokenVersion');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    // Case 1: Initial email verification
    if (user.emailVerificationToken === hashedToken) {
      if (!user.emailVerificationTokenExpires || user.emailVerificationTokenExpires < Date.now()) {
        return res.status(400).json({ message: 'Verification token has expired. Please request a new one.' });
      }

      user.isVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationTokenExpires = null;
      await user.save();

      return res.status(200).json({
        message: 'Email verified successfully. You now have full access to Campus Lost & Found.',
        isVerified: true,
      });
    }

    // Case 2: Pending email change verification
    if (user.pendingEmailToken === hashedToken) {
      if (!user.pendingEmailTokenExpires || user.pendingEmailTokenExpires < Date.now()) {
        return res.status(400).json({ message: 'Verification token has expired. Please request a new one.' });
      }

      const verifiedEmail = user.pendingEmail;
      user.email = verifiedEmail;
      user.pendingEmail = null;
      user.pendingEmailToken = null;
      user.pendingEmailTokenExpires = null;
      user.isVerified = true;
      // Invalidate existing sessions so user re-authenticates with new email
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      return res.status(200).json({
        message: 'Email updated and verified successfully.',
        isVerified: true,
        email: verifiedEmail,
      });
    }

    return res.status(400).json({ message: 'Invalid or expired verification token.' });
  } catch (error) {
    console.error('verifyEmail error:', error);
    return res.status(500).json({ message: 'Server error during email verification' });
  }
};

const resendVerification = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no session found' });
    }

    // Fetch user from DB to verify current isVerified status
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Your email is already verified.' });
    }

    const { rawToken, hashedToken, expires } = generateVerificationToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpires = expires;
    await user.save();

    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });

    return res.status(200).json({
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    console.error('resendVerification error:', error);
    return res.status(500).json({ message: 'Server error sending verification email' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  verifyEmail,
  resendVerification,
};
