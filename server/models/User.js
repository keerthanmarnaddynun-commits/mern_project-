const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'faculty', 'admin'],
      default: 'user',
    },
    department: {
      type: String,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },
    emailVerificationTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
    pendingEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    pendingEmailToken: {
      type: String,
      default: null,
      select: false,
    },
    pendingEmailTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      getters: false,
      virtuals: false,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationTokenExpires;
        delete ret.pendingEmailToken;
        delete ret.pendingEmailTokenExpires;
        return ret;
      },
    },
    toObject: {
      getters: false,
      virtuals: false,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationTokenExpires;
        delete ret.pendingEmailToken;
        delete ret.pendingEmailTokenExpires;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
