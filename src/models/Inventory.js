const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CafeProduct',
      required: true,
    },
    supplier: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
    },
    type: {
      type: String,
      enum: ['purchase', 'adjustment', 'sale', 'return', 'waste'],
      required: true,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 300,
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

inventorySchema.index({ organizationId: 1 });
inventorySchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('Inventory', inventorySchema);