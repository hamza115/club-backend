const { Router } = require('express');
const { inventoryController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const roleGuard = require('../middleware/roleGuard');
const { ROLES } = require('../config/constants');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth);
router.use(orgScope);

router.get('/', inventoryController.getStock);
router.get('/product/:productId/history', inventoryController.getStockHistory);

router.post(
  '/add-stock',
  roleGuard(ROLES.SUPER_ADMIN),
  validate([
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('unitPrice').optional().isNumeric(),
  ]),
  inventoryController.addStock,
);

router.post(
  '/adjust',
  roleGuard(ROLES.SUPER_ADMIN),
  validate([
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity').isNumeric().withMessage('Quantity must be a number'),
  ]),
  inventoryController.adjustStock,
);

module.exports = router;
