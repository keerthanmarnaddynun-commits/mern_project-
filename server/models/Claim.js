const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    lostItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    claimType: {
      type: String,
      enum: ['automatic', 'manual_review'],
      default: 'automatic',
    },
    manualReasonType: {
      type: String,
    },
    manualReasonText: {
      type: String,
    },
    department: {
      type: String,
      default: null,
    },
    verificationMethod: {
      type: String,
      default: null,
    },
    verificationNotes: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    isPermanentlyRejected: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

claimSchema.index({ itemId: 1, claimant: 1 }, { unique: true });

module.exports = mongoose.model('Claim', claimSchema);
