const mongoose = require('mongoose');

const supplierContactSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: 150,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      maxlength: 30,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

supplierContactSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model('SupplierContact', supplierContactSchema);
