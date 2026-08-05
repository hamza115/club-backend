const mongoose = require('mongoose');
const { MEMBERSHIP_TIERS } = require('../config/constants');

const membershipSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Membership name is required'],
      trim: true,
      maxlength: 50,
    },
    tier: {
      type: String,
      enum: Object.values(MEMBERSHIP_TIERS),
      required: [true, 'Tier is required'],
    },
    discount: {
      type: Number,
      required: [true, 'Discount percentage is required'],
      min: 0,
      max: 100,
    },
    validityDays: {
      type: Number,
      required: [true, 'Validity in days is required'],
      min: 1,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    benefits: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Membership', membershipSchema);