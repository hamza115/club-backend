const express = require('express');
const authRoutes = require('./auth.routes');
const customerRoutes = require('./customer.routes');
const tableRoutes = require('./table.routes');
const sessionRoutes = require('./session.routes');
const cafeRoutes = require('./cafe.routes');
const cafeOrderRoutes = require('./cafeOrder.routes');
const inventoryRoutes = require('./inventory.routes');
const supplierRoutes = require('./supplier.routes');
const expenseRoutes = require('./expense.routes');
const paymentRoutes = require('./payment.routes');
const reportRoutes = require('./report.routes');
const userRoutes = require('./user.routes');
const notificationRoutes = require('./notification.routes');
const settingRoutes = require('./setting.routes');
const activityLogRoutes = require('./activityLog.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/tables', tableRoutes);
router.use('/sessions', sessionRoutes);
router.use('/cafe/products', cafeRoutes);
router.use('/cafe/orders', cafeOrderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/expenses', expenseRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingRoutes);
router.use('/activity-logs', activityLogRoutes);

router.use('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
