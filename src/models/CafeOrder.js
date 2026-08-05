const mongoose = require('mongoose');

const cafeOrderSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
    },
    saleMode: {
      type: String,
      enum: ['session', 'walk_in'],
      default: 'walk_in',
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'mobile_wallet'],
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'partial'],
      default: 'paid',
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    items: [
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
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 300,
    },
    receiptNumber: {
      type: String,
      unique: true,
      sparse: true,
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

cafeOrderSchema.pre('save', async function (next) {
  if (!this.receiptNumber && this.totalAmount > 0) {
    const date = new Date();
    const prefix = `CAF-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const count = await mongoose.model('CafeOrder').countDocuments({
      receiptNumber: { $regex: `^${prefix}` },
    });
    this.receiptNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('CafeOrder', cafeOrderSchema);
