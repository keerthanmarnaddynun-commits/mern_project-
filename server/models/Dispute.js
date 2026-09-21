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
  { timestamps: true, collection: 'disputes' }
);

module.exports = mongoose.model('Dispute', disputeSchema);
