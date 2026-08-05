const mongoose = require('mongoose');
const { PAYMENT_METHOD, EXPENSE_CATEGORIES, EXPENSE_STATUS, EXPENSE_RECURRENCE } = require('../config/constants');

const expenseSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: [true, 'Category is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      required: [true, 'Payment method is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 500,
    },
    vendor: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    attachment: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(EXPENSE_STATUS),
      default: EXPENSE_STATUS.PENDING,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurrenceFrequency: {
      type: String,
      enum: Object.values(EXPENSE_RECURRENCE),
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
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

expenseSchema.index({ organizationId: 1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ status: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
