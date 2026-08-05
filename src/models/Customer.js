const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      default: null,
    },
    membershipExpiry: {
      type: Date,
      default: null,
    },
    visitCount: {
      type: Number,
      default: 0,
    },
    lifetimeSpending: {
      type: Number,
      default: 0,
    },
    lastVisit: {
      type: Date,
      default: null,
    },
    outstandingBalance: {
      type: Number,
      default: 0,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

customerSchema.index({ organizationId: 1 });
customerSchema.index({ name: 'text', phone: 'text' });

module.exports = mongoose.model('Customer', customerSchema);