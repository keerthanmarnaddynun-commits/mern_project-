const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['lost', 'found'],
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    date_occurred: {
      type: String,
      required: true,
    },
    image_url: {
      type: String,
      default: null,
    },
    contact_email: {
      type: String,
      required: true,
    },
    contact_phone: {
      type: String,
      default: null,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending',
    },
    is_resolved: {
      type: Boolean,
      default: false,
    },
    custodyStatus: {
      type: String,
      enum: ['not_handed_over', 'department_received', 'returned'],
      default: 'not_handed_over',
    },
    custodyLocation: {
      type: String,
      default: null,
    },
    custodyDepartment: {
      type: String,
      default: null,
    },
    receiverName: {
      type: String,
      default: null,
    },
    receiverRole: {
      type: String,
      default: null,
    },
    handoverNotes: {
      type: String,
      default: null,
    },
    handoverDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
