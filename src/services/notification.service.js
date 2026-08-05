const { Notification, Table } = require('../models');
const { NOTIFICATION_PRIORITY, NOTIFICATION_CATEGORIES } = require('../config/constants');
const { emitToOrg } = require('../socket');

/**
 * Resolve a display-friendly table label from a session.
 * Handles both populated (table.tableNumber) and un-populated (raw ObjectId) cases.
 */
const resolveTableLabel = async (session) => {
  // Populated: session.table is a full doc with tableNumber
  if (session.table?.tableNumber) return `Table ${session.table.tableNumber}`;
  // Un-populated but has a numeric tableNumber (shouldn't happen with current schema, but safe)
  if (typeof session.tableNumber === 'number') return `Table ${session.tableNumber}`;
  // Un-populated ObjectId: look up the Table doc
  if (session.table) {
    const table = await Table.findById(session.table).select('tableNumber').lean();
    if (table) return `Table ${table.tableNumber}`;
  }
  return 'Unknown table';
};

const createNotification = async ({
  title,
  message,
  type,
  category = NOTIFICATION_CATEGORIES.SYSTEM,
  priority = NOTIFICATION_PRIORITY.LOW,
  link = null,
  recipient = null,
  relatedId = null,
  relatedModel = null,
  organizationId = null,
  io = null,
}) => {
  const notification = await Notification.create({
    organizationId,
    title,
    message,
    type,
    category,
    priority,
    link,
    recipient,
    relatedId,
    relatedModel,
  });

  if (io && organizationId) {
    emitToOrg(io, organizationId, 'notification:new', {
      notification: notification.toObject(),
    });
  }

  return notification;
};

// ── Inventory Notifications ──

const notifyLowInventory = async (product, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Low Inventory Alert',
    message: `${product.name} stock is low (${product.stockQuantity} remaining). Threshold: ${product.minStockThreshold}`,
    type: 'low_inventory',
    category: NOTIFICATION_CATEGORIES.INVENTORY,
    priority: NOTIFICATION_PRIORITY.HIGH,
    link: '/inventory',
    relatedId: product._id,
    relatedModel: 'CafeProduct',
    io,
  });
};

const notifyOutOfStock = async (product, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Out of Stock',
    message: `${product.name} is now out of stock. Reorder immediately.`,
    type: 'out_of_stock',
    category: NOTIFICATION_CATEGORIES.INVENTORY,
    priority: NOTIFICATION_PRIORITY.HIGH,
    link: '/inventory',
    relatedId: product._id,
    relatedModel: 'CafeProduct',
    io,
  });
};

const notifyStockPurchase = async (product, quantity, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Stock Purchased',
    message: `${quantity} units of ${product.name} added to inventory.`,
    type: 'stock_purchase',
    category: NOTIFICATION_CATEGORIES.INVENTORY,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: '/inventory',
    relatedId: product._id,
    relatedModel: 'CafeProduct',
    io,
  });
};

const notifyStockAdjustment = async (product, quantity, organizationId, io = null) => {
  const direction = quantity > 0 ? 'increased' : 'decreased';
  return createNotification({
    organizationId,
    title: 'Stock Adjusted',
    message: `${product.name} stock ${direction} by ${Math.abs(quantity)}. New stock: ${product.stockQuantity}`,
    type: 'stock_adjustment',
    category: NOTIFICATION_CATEGORIES.INVENTORY,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: '/inventory',
    relatedId: product._id,
    relatedModel: 'CafeProduct',
    io,
  });
};

// ── Session Notifications ──

const notifySessionStarted = async (session, organizationId, io = null) => {
  const tableLabel = await resolveTableLabel(session);
  return createNotification({
    organizationId,
    title: 'Session Started',
    message: `Session started on ${tableLabel}.`,
    type: 'session_started',
    category: NOTIFICATION_CATEGORIES.SESSION,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    io,
  });
};

const notifySessionEnded = async (session, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Session Ended',
    message: `Session ended. Total: ${session.finalAmount || 'N/A'}.`,
    type: 'session_ended',
    category: NOTIFICATION_CATEGORIES.SESSION,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    io,
  });
};

const notifySessionPaused = async (session, organizationId, io = null) => {
  const tableLabel = await resolveTableLabel(session);
  return createNotification({
    organizationId,
    title: 'Session Paused',
    message: `Session on ${tableLabel} has been paused.`,
    type: 'session_paused',
    category: NOTIFICATION_CATEGORIES.SESSION,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    io,
  });
};

const notifySessionResumed = async (session, organizationId, io = null) => {
  const tableLabel = await resolveTableLabel(session);
  return createNotification({
    organizationId,
    title: 'Session Resumed',
    message: `Session on ${tableLabel} has been resumed.`,
    type: 'session_resumed',
    category: NOTIFICATION_CATEGORIES.SESSION,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    io,
  });
};

const notifySessionLongDuration = async (session, hours, organizationId, io = null) => {
  const tableLabel = await resolveTableLabel(session);
  return createNotification({
    organizationId,
    title: 'Long Running Session',
    message: `Session on ${tableLabel} has been running for ${hours} hours.`,
    type: 'session_long_duration',
    category: NOTIFICATION_CATEGORIES.SESSION,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    recipient: null,
    io,
  });
};

// ── Payment Notifications ──

const notifyPaymentReceived = async (payment, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Payment Received',
    message: `Payment of ${payment.amount} received via ${payment.method}.`,
    type: 'payment_received',
    category: NOTIFICATION_CATEGORIES.PAYMENT,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: `/sessions/${payment.session}`,
    relatedId: payment._id,
    relatedModel: 'Payment',
    io,
  });
};

const notifyPaymentPartial = async (session, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Partial Payment',
    message: `Session #${session.receiptNumber || session._id} has a partial payment. Remaining: ${session.finalAmount - session.amountPaid}`,
    type: 'payment_partial',
    category: NOTIFICATION_CATEGORIES.PAYMENT,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    io,
  });
};

const notifyPendingPayment = async (session, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Pending Payment',
    message: `Session #${session.receiptNumber || session._id} has a pending payment of ${session.finalAmount - (session.amountPaid || 0)}`,
    type: 'pending_payment',
    category: NOTIFICATION_CATEGORIES.PAYMENT,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    io,
  });
};

const notifyPaymentOverdue = async (session, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Payment Overdue',
    message: `Session #${session.receiptNumber || session._id} payment is overdue. Amount: ${session.finalAmount - (session.amountPaid || 0)}`,
    type: 'payment_overdue',
    category: NOTIFICATION_CATEGORIES.PAYMENT,
    priority: NOTIFICATION_PRIORITY.HIGH,
    link: `/sessions/${session._id}`,
    relatedId: session._id,
    relatedModel: 'Session',
    io,
  });
};

// ── Cafe Notifications ──

const notifyCafeWalkInOrder = async (order, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Walk-in Cafe Order',
    message: `New walk-in order for ${order.items.length} item(s). Total: ${order.totalAmount}`,
    type: 'cafe_walk_in_order',
    category: NOTIFICATION_CATEGORIES.CAFE,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: `/cafe/orders/${order._id}`,
    relatedId: order._id,
    relatedModel: 'CafeOrder',
    io,
  });
};

const notifyCafeSessionOrder = async (order, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Session Cafe Order',
    message: `Cafe order added to session. ${order.items.length} item(s). Total: ${order.totalAmount}`,
    type: 'cafe_session_order',
    category: NOTIFICATION_CATEGORIES.CAFE,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: `/cafe/orders/${order._id}`,
    relatedId: order._id,
    relatedModel: 'CafeOrder',
    io,
  });
};

const notifyCafeLargeOrder = async (order, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Large Cafe Order',
    message: `Large order received! ${order.items.length} item(s) totaling ${order.totalAmount}.`,
    type: 'cafe_large_order',
    category: NOTIFICATION_CATEGORIES.CAFE,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: `/cafe/orders/${order._id}`,
    relatedId: order._id,
    relatedModel: 'CafeOrder',
    io,
  });
};

// ── Expense Notifications ──

const notifyExpenseCreated = async (expense, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Expense Created',
    message: `New expense: ${expense.title} - ${expense.category} - ${expense.amount}. Status: Pending.`,
    type: 'expense_created',
    category: NOTIFICATION_CATEGORIES.EXPENSE,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: '/expenses',
    relatedId: expense._id,
    relatedModel: 'Expense',
    io,
  });
};

const notifyExpenseApproved = async (expense, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Expense Approved',
    message: `${expense.title} (${expense.category} - ${expense.amount}) has been approved.`,
    type: 'expense_approved',
    category: NOTIFICATION_CATEGORIES.EXPENSE,
    priority: NOTIFICATION_PRIORITY.LOW,
    link: '/expenses',
    relatedId: expense._id,
    relatedModel: 'Expense',
    recipient: expense.createdBy,
    io,
  });
};

const notifyExpenseRejected = async (expense, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Expense Rejected',
    message: `${expense.title} (${expense.category} - ${expense.amount}) has been rejected.`,
    type: 'expense_rejected',
    category: NOTIFICATION_CATEGORIES.EXPENSE,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: '/expenses',
    relatedId: expense._id,
    relatedModel: 'Expense',
    recipient: expense.createdBy,
    io,
  });
};

const notifyExpenseBudgetExceeded = async (category, spent, budget, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Budget Exceeded',
    message: `${category} expenses (${spent}) have exceeded the budget (${budget}).`,
    type: 'expense_budget_exceeded',
    category: NOTIFICATION_CATEGORIES.EXPENSE,
    priority: NOTIFICATION_PRIORITY.HIGH,
    link: '/expenses',
    io,
  });
};

// ── User Management Notifications ──

const notifyUserCreated = async (newUser, createdBy, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'New User Account',
    message: `${createdBy} created a ${newUser.role} account for ${newUser.name}.`,
    type: 'user_created',
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: '/staff',
    relatedId: newUser._id,
    relatedModel: 'User',
    io,
  });
};

const notifyPasswordChanged = async (user, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Password Changed',
    message: `Password changed for ${user.name}.`,
    type: 'user_password_changed',
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: '/staff',
    relatedId: user._id,
    relatedModel: 'User',
    io,
  });
};

const notifyFailedLogin = async (email, organizationId = null, io = null) => {
  let orgId = organizationId;
  if (!orgId && email) {
    const { User } = require('../models');
    const user = await User.findOne({ email }).select('organizationId');
    if (user) {
      orgId = user.organizationId;
    }
  }

  if (!orgId) return;

  return createNotification({
    organizationId: orgId,
    title: 'Failed Login Attempt',
    message: `Failed login attempt for email: ${email}`,
    type: 'user_failed_login',
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITY.LOW,
    io,
  });
};

const notifyAccountLocked = async (user, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Account Locked',
    message: `${user.name}'s account has been deactivated.`,
    type: 'user_account_locked',
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITY.HIGH,
    link: '/staff',
    relatedId: user._id,
    relatedModel: 'User',
    io,
  });
};

const notifyAccountUnlocked = async (user, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Account Unlocked',
    message: `${user.name}'s account has been reactivated.`,
    type: 'user_account_unlocked',
    category: NOTIFICATION_CATEGORIES.USER,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: '/staff',
    relatedId: user._id,
    relatedModel: 'User',
    io,
  });
};

// ── Backup Notifications ──

const notifyBackupSuccess = async (organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Backup Completed',
    message: 'System backup completed successfully.',
    type: 'backup_success',
    category: NOTIFICATION_CATEGORIES.BACKUP,
    priority: NOTIFICATION_PRIORITY.LOW,
    io,
  });
};

const notifyBackupFailed = async (error, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Backup Failed',
    message: `System backup failed: ${error}`,
    type: 'backup_failed',
    category: NOTIFICATION_CATEGORIES.BACKUP,
    priority: NOTIFICATION_PRIORITY.HIGH,
    io,
  });
};

const notifyBackupRestored = async (organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Backup Restored',
    message: 'System has been restored from a backup.',
    type: 'backup_restored',
    category: NOTIFICATION_CATEGORIES.BACKUP,
    priority: NOTIFICATION_PRIORITY.HIGH,
    io,
  });
};

// ── Daily Closing Notifications ──

const notifyDailyClosing = async (report, organizationId, io = null) => {
  return createNotification({
    organizationId,
    title: 'Daily Closing Report',
    message: `Daily closing for ${report.date}. Revenue: ${report.totalRevenue || 0}, Expenses: ${report.totalExpenses || 0}, Net: ${report.netProfit || 0}`,
    type: 'daily_closing',
    category: NOTIFICATION_CATEGORIES.DAILY_CLOSING,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    link: '/reports',
    io,
  });
};

module.exports = {
  createNotification,
  notifyLowInventory,
  notifyOutOfStock,
  notifyStockPurchase,
  notifyStockAdjustment,
  notifySessionStarted,
  notifySessionEnded,
  notifySessionPaused,
  notifySessionResumed,
  notifySessionLongDuration,
  notifyPaymentReceived,
  notifyPaymentPartial,
  notifyPendingPayment,
  notifyPaymentOverdue,
  notifyCafeWalkInOrder,
  notifyCafeSessionOrder,
  notifyCafeLargeOrder,
  notifyExpenseCreated,
  notifyExpenseApproved,
  notifyExpenseRejected,
  notifyExpenseBudgetExceeded,
  notifyUserCreated,
  notifyPasswordChanged,
  notifyFailedLogin,
  notifyAccountLocked,
  notifyAccountUnlocked,
  notifyBackupSuccess,
  notifyBackupFailed,
  notifyBackupRestored,
  notifyDailyClosing,
};
