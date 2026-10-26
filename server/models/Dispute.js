const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    challengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    currentOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Dispute reason is required'],
      trim: true,
    },
    proofUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2048,
      validate: {
        validator(value) {
          if (value == null || value === '') return true;
          try {
            const parsed = new URL(value);
            return parsed.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Proof URL must be a valid HTTPS URL',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'recall_pending', 'ready_for_pickup', 'resolved', 'rejected'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'disputes',
    toJSON: { getters: false, virtuals: false },
    toObject: { getters: false, virtuals: false },
  }
);

module.exports = mongoose.model('Dispute', disputeSchema);
