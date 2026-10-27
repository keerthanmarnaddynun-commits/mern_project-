const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const auditLogger = require('../utils/auditLogger');
const { clearCsrfCookie } = require('../middleware/csrf');
const {
  generateVerificationToken,
  sendVerificationEmail,
  sendEmailChangeNotification,
} = require('../utils/email');

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

function extractSafeUploadPath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const normalized = imageUrl.replace(/\\/g, '/').trim();
  const match = normalized.match(/(?:^|\/)uploads\/([a-zA-Z0-9_.-]+)$/);
  if (!match) return null;

  const filename = match[1];
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return null;
  }

  const resolvedPath = path.resolve(UPLOADS_DIR, filename);
  if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }

  return resolvedPath;
}

async function cleanupUploadedFiles(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) return;
  for (const filePath of filePaths) {
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`[file-cleanup] Failed to delete orphaned upload file: ${filePath}`, err.message);
      }
    }
  }
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

async function verifyCurrentPassword(userId, currentPassword) {
  const userWithPassword = await User.findById(userId).select('+password');
  if (!userWithPassword || !userWithPassword.password) {
    return { ok: false, status: 401, message: 'Incorrect current password.' };
  }
  const match = await bcrypt.compare(String(currentPassword), userWithPassword.password);
  if (!match) {
    return { ok: false, status: 401, message: 'Incorrect current password.' };
  }
  return { ok: true, user: userWithPassword };
}

function clearAuthCookies(res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  clearCsrfCookie(res);
}

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

    const { name, email, currentPassword, newPassword, password } = req.body || {};

    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ message: 'Name must be a string' });
    }
    if (email !== undefined && typeof email !== 'string') {
      return res.status(400).json({ message: 'Email must be a string' });
    }
    if (currentPassword !== undefined && typeof currentPassword !== 'string') {
      return res.status(400).json({ message: 'Current password must be a string' });
    }
    if (newPassword !== undefined && typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'New password must be a string' });
    }
    if (password !== undefined && typeof password !== 'string') {
      return res.status(400).json({ message: 'Password must be a string' });
    }

    const nextEmail = email !== undefined ? String(email).toLowerCase().trim() : null;
    const emailChanging = Boolean(nextEmail && nextEmail !== String(user.email).toLowerCase());
    const nextPassword = newPassword || password;
    const passwordChanging = Boolean(nextPassword);

    if (emailChanging || passwordChanging) {
      if (!currentPassword) {
        return res.status(400).json({
          message: emailChanging
            ? 'Current password is required to change your email.'
            : 'Current password is required to change your password.',
        });
      }

      const verified = await verifyCurrentPassword(user._id, currentPassword);
      if (!verified.ok) {
        return res.status(verified.status).json({ message: verified.message });
      }

      const updates = {};
      if (name) updates.name = name.trim();

      let emailPendingTokenRaw = null;
      if (emailChanging) {
        const emailExists = await User.findOne({
          $or: [{ email: nextEmail }, { pendingEmail: nextEmail }],
          _id: { $ne: user._id },
        });
        if (emailExists) {
          return res.status(400).json({ message: 'Email is already in use' });
        }

        // Generate verification token for pending email
        const tokenData = generateVerificationToken();
        emailPendingTokenRaw = tokenData.rawToken;
        updates.pendingEmail = nextEmail;
        updates.pendingEmailToken = tokenData.hashedToken;
        updates.pendingEmailTokenExpires = tokenData.expires;
      }

      const updateOp = { $set: updates };

      if (passwordChanging) {
        if (!validatePasswordComplexity(nextPassword)) {
          return res.status(400).json({
            message:
              'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
          });
        }
        const salt = await bcrypt.genSalt(10);
        updates.password = await bcrypt.hash(String(nextPassword), salt);
        // Invalidate tokens immediately on password change
        updateOp.$inc = { tokenVersion: 1 };
      }

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        updateOp,
        { new: true, runValidators: true }
      );

      // If email is changing, dispatch verification email to new address and security alert to old address
      if (emailChanging && emailPendingTokenRaw) {
        sendVerificationEmail({
          to: nextEmail,
          name: updatedUser.name || user.name,
          token: emailPendingTokenRaw,
          isChange: true,
        }).catch((err) => console.error('Error sending email change verification link:', err?.message || err));

        sendEmailChangeNotification({
          to: user.email,
          name: user.name,
          newEmail: nextEmail,
        }).catch((err) => console.error('Error sending email change alert to old email:', err?.message || err));
      }

      if (emailChanging) {
        auditLogger.log({
          req,
          action: 'USER_EMAIL_CHANGE_REQUESTED',
          category: 'AUTH',
          severity: 'INFO',
          outcome: 'SUCCESS',
          statusCode: 200,
          targetType: 'User',
          targetId: updatedUser._id,
          metadata: { oldEmail: user.email, newEmail: nextEmail },
        });
      }

      if (passwordChanging) {
        auditLogger.log({
          req,
          action: 'USER_PASSWORD_CHANGED',
          category: 'AUTH',
          severity: 'INFO',
          outcome: 'SUCCESS',
          statusCode: 200,
          targetType: 'User',
          targetId: updatedUser._id,
          metadata: { email: user.email },
        });
      }

      return res.status(200).json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        pendingEmail: updatedUser.pendingEmail || null,
        isVerified: updatedUser.isVerified,
        message: emailChanging
          ? 'A verification link has been sent to your new email address. Please verify it to complete the update.'
          : 'Profile updated successfully.',
      });
    }

    if (name) {
      user.name = name.trim();
    }

    const updatedUser = await user.save();

    return res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (!validatePasswordComplexity(newPassword)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
      });
    }

    const verified = await verifyCurrentPassword(req.user._id, currentPassword);
    if (!verified.ok) {
      return res.status(verified.status).json({ message: verified.message });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(newPassword), salt);

    // Atomically update password and increment tokenVersion
    await User.findByIdAndUpdate(req.user._id, {
      $set: { password: hashedPassword },
      $inc: { tokenVersion: 1 },
    });

    auditLogger.log({
      req,
      action: 'USER_PASSWORD_CHANGED',
      category: 'AUTH',
      severity: 'INFO',
      outcome: 'SUCCESS',
      statusCode: 200,
      targetType: 'User',
      targetId: req.user._id,
      metadata: { email: req.user.email },
    });

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({ message: 'Server error changing password' });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const { currentPassword, confirmDelete } = req.body || {};

    if (confirmDelete !== true) {
      return res.status(400).json({
        message: 'Account deletion must be confirmed.',
      });
    }

    if (!currentPassword) {
      return res.status(400).json({
        message: 'Current password is required to delete your account.',
      });
    }

    const verified = await verifyCurrentPassword(req.user._id, currentPassword);
    if (!verified.ok) {
      return res.status(verified.status).json({ message: verified.message });
    }

    const userId = req.user._id;
    const filesToDelete = [];

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Fetch user items to collect IDs and physical upload image paths
        const itemsQuery = Item.find({ postedBy: userId });
        const userItems = (itemsQuery && typeof itemsQuery.session === 'function'
          ? await itemsQuery.session(session)
          : await itemsQuery) || [];

        const userItemIds = Array.isArray(userItems) ? userItems.map((item) => item._id) : [];

        for (const item of userItems) {
          const safePath = extractSafeUploadPath(item.image_url);
          if (safePath) {
            filesToDelete.push(safePath);
          }
        }

        // 2. Cascade delete claims made by the user
        await Claim.deleteMany({ claimant: userId }, { session });

        // 3. Cascade delete claims associated with user's items
        if (userItemIds.length > 0) {
          await Claim.deleteMany(
            {
              $or: [
                { itemId: { $in: userItemIds } },
                { lostItemId: { $in: userItemIds } },
              ],
            },
            { session }
          );
        }

        // 4. Cascade delete disputes involving user or user's items
        const disputeOrConditions = [
          { challengerId: userId },
          { currentOwnerId: userId },
        ];
        if (userItemIds.length > 0) {
          disputeOrConditions.push({ itemId: { $in: userItemIds } });
        }

        const disputeQuery = Dispute.find({ $or: disputeOrConditions });
        const relatedDisputes = (disputeQuery && typeof disputeQuery.session === 'function'
          ? await disputeQuery.session(session)
          : await disputeQuery) || [];

        const relatedDisputeIds = Array.isArray(relatedDisputes)
          ? relatedDisputes.map((d) => d._id)
          : [];

        // Identify foreign items challenged by this user to reset isDisputed flag if needed
        const foreignItemIdsToReset = [];
        for (const d of relatedDisputes) {
          if (
            d.challengerId &&
            d.challengerId.toString() === userId.toString() &&
            d.itemId &&
            !userItemIds.some((uid) => uid.toString() === d.itemId.toString())
          ) {
            foreignItemIdsToReset.push(d.itemId);
          }
        }

        if (relatedDisputeIds.length > 0) {
          await Dispute.deleteMany({ _id: { $in: relatedDisputeIds } }, { session });
        }

        // Clean up isDisputed flag on foreign items if no pending disputes remain
        for (const foreignItemId of foreignItemIdsToReset) {
          const countQuery = Dispute.countDocuments({
            itemId: foreignItemId,
            status: { $in: ['pending', 'recall_pending'] },
          });
          const remainingPending = countQuery && typeof countQuery.session === 'function'
            ? await countQuery.session(session)
            : await countQuery;

          if (remainingPending === 0) {
            await Item.findByIdAndUpdate(
              foreignItemId,
              {
                $set: {
                  isDisputed: false,
                  disputeReason: null,
                  disputeProofUrl: null,
                },
              },
              { session }
            );
          }
        }

        // 5. Cascade delete notifications for user, user's items, or user's disputes
        const notifOrConditions = [{ userId }];
        if (userItemIds.length > 0) {
          notifOrConditions.push({ itemId: { $in: userItemIds } });
        }
        if (relatedDisputeIds.length > 0) {
          notifOrConditions.push({ disputeId: { $in: relatedDisputeIds } });
        }
        await Notification.deleteMany({ $or: notifOrConditions }, { session });

        // 6. Anonymize audit & activity logs (preserve audit trail, scrub PII)
        await Activity.updateMany(
          { userId },
          {
            $set: {
              userId: null,
              actorName: 'Deleted User',
              actorEmail: 'deleted@campus.edu',
            },
          },
          { session }
        );
        if (userItemIds.length > 0) {
          await Activity.updateMany(
            { itemId: { $in: userItemIds } },
            { $set: { itemId: null } },
            { session }
          );
        }

        // 7. Cascade delete user's items
        await Item.deleteMany({ postedBy: userId }, { session });

        // 8. Atomically increment tokenVersion and delete User document last
        await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { session });
        await User.findByIdAndDelete(userId, { session });
      });
    } finally {
      await session.endSession();
    }

    // 9. Post-commit: Clean up physical uploaded files only after transaction commits
    await cleanupUploadedFiles(filesToDelete);

    clearAuthCookies(res);

    auditLogger.log({
      req,
      actorId: userId,
      action: 'USER_ACCOUNT_DELETED',
      category: 'AUTH',
      severity: 'WARNING',
      outcome: 'SUCCESS',
      statusCode: 200,
      targetType: 'User',
      targetId: userId,
      metadata: { email: req.user.email },
    });

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('[deleteProfile] Cascade deletion failed:', {
      userId: req.user?._id,
      operation: 'deleteProfile',
      error: error.message,
    });
    return res.status(500).json({ message: 'Account deletion failed. Please try again.' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteProfile,
};
