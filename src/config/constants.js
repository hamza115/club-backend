const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
});

const TABLE_STATUS = Object.freeze({
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance',
});

const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const PRICING_METHOD = Object.freeze({
  HOURLY: 'hourly',
  FRAME: 'frame',
  CUSTOM: 'custom',
  PER_MINUTE: 'per_minute',
});

const PAYMENT_STATUS = Object.freeze({
  PAID: 'paid',
  PENDING: 'pending',
  PARTIAL: 'partial',
});

const PAYMENT_METHOD = Object.freeze({
  CASH: 'cash',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  MOBILE_WALLET: 'mobile_wallet',
});

const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

const NOTIFICATION_CATEGORIES = Object.freeze({
  INVENTORY: 'inventory',
  SESSION: 'session',
  PAYMENT: 'payment',
  CAFE: 'cafe',
  EXPENSE: 'expense',
  USER: 'user',
  BACKUP: 'backup',
  DAILY_CLOSING: 'daily_closing',
  SYSTEM: 'system',
});

const EXPENSE_CATEGORIES = Object.freeze([
  'rent',
  'electricity',
  'water',
  'internet',
  'salaries',
  'purchases',
  'repairs',
  'maintenance',
  'cleaning',
  'marketing',
  'fuel',
  'office_supplies',
  'taxes',
  'miscellaneous',
]);

const EXPENSE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const EXPENSE_RECURRENCE = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
});

const REPORT_TYPES = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
  PROFIT: 'profit',
  CUSTOMER: 'customer',
  INVENTORY: 'inventory',
  CAFE_SALES: 'cafe_sales',
  TABLE_USAGE: 'table_usage',
  PAYMENT: 'payment',
});

const ALL_ROLES = Object.values(ROLES);

module.exports = {
  ROLES,
  TABLE_STATUS,
  SESSION_STATUS,
  PRICING_METHOD,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_CATEGORIES,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS,
  EXPENSE_RECURRENCE,
  REPORT_TYPES,
  ALL_ROLES,
};