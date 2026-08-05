const mongoose = require('mongoose');
const { SESSION_STATUS, PRICING_METHOD, PAYMENT_STATUS, PAYMENT_METHOD } = require('../config/constants');

const sessionItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CafeProduct',
      required: true,
    },
    name: String,
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
  },
  { _id: true },
);

const sessionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
    },
    groupId: {
      type: String,
      default: null,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: [true, 'Table is required'],
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.ACTIVE,
    },
    pricingMethod: {
      type: String,
      enum: Object.values(PRICING_METHOD),
      required: [true, 'Pricing method is required'],
    },
    hourlyRate: { type: Number, default: 0 },
    frameRate: { type: Number, default: 0 },
    customRate: { type: Number, default: 0 },
    perMinuteRate: { type: Number, default: 0 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    totalPausedDuration: { type: Number, default: 0 },
    totalPlayingTime: { type: Number, default: 0 },
    totalFrames: { type: Number, default: 0 },
    tableCharges: { type: Number, default: 0 },
    cafeCharges: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    discountReason: { type: String, default: '' },
    finalAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: null,
    },
    amountPaid: { type: Number, default: 0 },
    receiptNumber: { type: String, unique: true, sparse: true },
    cafeItems: [sessionItemSchema],
    notes: { type: String, default: '', maxlength: 500 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

sessionSchema.index({ organizationId: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ createdAt: -1 });
sessionSchema.index({ customer: 1 });
sessionSchema.index({ table: 1 });
sessionSchema.index({ groupId: 1 });

sessionSchema.pre('save', async function (next) {
  if (!this.receiptNumber && this.finalAmount > 0) {
    const date = new Date();
    const prefix = `RCP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await mongoose.model('Session').countDocuments({
      receiptNumber: { $regex: `^${prefix}` },
    });
    this.receiptNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Session', sessionSchema);