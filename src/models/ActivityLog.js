const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      maxlength: 200,
    },
    module: {
      type: String,
      required: [true, 'Module is required'],
      enum: [
        'auth',
        'customer',
        'table',
        'session',
        'cafe',
        'inventory',
        'membership',
        'expense',
        'payment',
        'report',
        'user',
        'settings',
        'dashboard',
      ],
    },
    details: {
      type: String,
      default: '',
      maxlength: 500,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    resourceModel: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1 });
activityLogSchema.index({ module: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);