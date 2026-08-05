const authController = require('./auth.controller');
const customerController = require('./customer.controller');
const tableController = require('./table.controller');
const sessionController = require('./session.controller');
const cafeController = require('./cafe.controller');
const inventoryController = require('./inventory.controller');
const supplierController = require('./supplier.controller');
const expenseController = require('./expense.controller');
const paymentController = require('./payment.controller');
const reportController = require('./report.controller');
const userController = require('./user.controller');
const notificationController = require('./notification.controller');
const settingController = require('./setting.controller');
const activityLogController = require('./activityLog.controller');

module.exports = {
  authController,
  customerController,
  tableController,
  sessionController,
  cafeController,
  inventoryController,
  supplierController,
  expenseController,
  paymentController,
  reportController,
  userController,
  notificationController,
  settingController,
  activityLogController,
};
