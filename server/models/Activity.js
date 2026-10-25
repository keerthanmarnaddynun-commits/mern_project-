const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'user_registered',
        'item_reported',
        'claim_submitted',
        'claim_approved',
        'claim_rejected',
        'claim_auto_rejected',
        'item_resolved',
        'account_deleted',
        'dispute_raised',
        'fraud_alert',
        'dispute_closed',
        'dispute_resolved',
        'item_verified',
        'handover_denied',
        'item_recovered',
        'handover_completed',
      ],
    },
    message: {
      type: String,
      required: true,
    },
    actorName: {
      type: String,
    },
    actorEmail: {
      type: String,
    },
    itemTitle: {
      type: String,
    },
    relatedItemTitle: {
      type: String,
    },
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Claim',
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', activitySchema);
