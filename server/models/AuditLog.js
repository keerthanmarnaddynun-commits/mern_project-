const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      ref: 'User',
    },
    actorRole: {
      type: String,
      enum: ['user', 'faculty', 'admin', 'anonymous', 'system'],
      default: 'anonymous',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['AUTH', 'AUTHZ', 'ITEM', 'CLAIM', 'DISPUTE', 'ADMIN', 'SECURITY', 'UPLOAD'],
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO',
    },
    targetType: {
      type: String,
      default: null,
      trim: true,
    },
    targetId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    outcome: {
      type: String,
      required: true,
      enum: ['SUCCESS', 'FAILURE', 'BLOCKED'],
      default: 'SUCCESS',
    },
    ip: {
      type: String,
      default: null,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: { getters: false, virtuals: false },
    toObject: { getters: false, virtuals: false },
  }
);

// Explicit required indexes
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ category: 1 });
auditLogSchema.index({ targetType: 1 });
auditLogSchema.index({ severity: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
