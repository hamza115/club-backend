const { Router } = require('express');
const { reportController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { ROLES } = require('../config/constants');
const roleGuard = require('../middleware/roleGuard');

const router = Router();

router.use(auth);
router.use(orgScope);
router.use(roleGuard(ROLES.SUPER_ADMIN, ROLES.MANAGER));

router.get('/dashboard', reportController.getDashboard);
router.get('/revenue', reportController.getRevenueReport);
router.get('/expense', reportController.getExpenseReport);
router.get('/profit', reportController.getProfitReport);
router.get('/customer', reportController.getCustomerReport);
router.get('/sessions', reportController.getSessionReport);
router.get('/table-usage', reportController.getTableUsageReport);
router.get('/cafe-sales', reportController.getCafeSalesReport);
router.get('/product-sales', reportController.getProductSalesReport);
router.get('/inventory', reportController.getInventoryReport);
router.get('/payment', reportController.getPaymentReport);
router.get('/daily-closing', reportController.getDailyClosingReport);
router.get('/insights', reportController.getBusinessInsights);

module.exports = router;
