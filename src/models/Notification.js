const mongoose = require('mongoose');
const { NOTIFICATION_PRIORITY, NOTIFICATION_CATEGORIES } = require('../config/constants');

const notificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: 500,
    },
    type: {
      type: String,
      enum: [
        'low_inventory',
        'out_of_stock',
        'stock_purchase',
        'stock_adjustment',
        'session_started',
        'session_ended',
        'session_paused',
        'session_resumed',
        'session_long_duration',
        'payment_received',
        'payment_partial',
        'payment_pending',
        'payment_overdue',
        'cafe_walk_in_order',
        'cafe_session_order',
        'cafe_large_order',
        'expense_created',
        'expense_approved',
        'expense_rejected',
        'expense_budget_exceeded',
        'user_created',
        'user_password_changed',
        'user_failed_login',
        'user_account_locked',
        'user_account_unlocked',
        'backup_success',
        'backup_failed',
        'backup_restored',
        'daily_closing',
        'pending_payment',
        'system',
      ],
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(NOTIFICATION_CATEGORIES),
      required: true,
      default: NOTIFICATION_CATEGORIES.SYSTEM,
    },
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITY),
      default: NOTIFICATION_PRIORITY.LOW,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    link: {
      type: String,
      default: null,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedModel: {
      type: String,
      enum: ['Session', 'Payment', 'CafeOrder', 'Expense', 'Inventory', 'CafeProduct', 'User', 'Setting', null],
      default: null,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1 });
notificationSchema.index({ organizationId: 1, createdAt: -1 });
notificationSchema.index({ isArchived: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
