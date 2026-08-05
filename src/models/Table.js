const mongoose = require('mongoose');
const { TABLE_STATUS } = require('../config/constants');

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: Number,
      required: [true, 'Table number is required'],
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(TABLE_STATUS),
      default: TABLE_STATUS.AVAILABLE,
    },
    currentSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    currentGroupId: {
      type: String,
      default: null,
    },
    currentCustomerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },
    frameRate: {
      type: Number,
      default: 0,
    },
    perMinuteRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 300,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

tableSchema.index({ organizationId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model('Table', tableSchema);