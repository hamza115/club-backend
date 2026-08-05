const { Router } = require('express');
const { cafeController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const roleGuard = require('../middleware/roleGuard');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth);
router.use(orgScope);

router.get(
  '/',
  roleGuard('manager', 'cashier'),
  cafeController.getOrders,
);

router.get(
  '/:id',
  roleGuard('manager', 'cashier'),
  cafeController.getOrder,
);

router.post(
  '/walk-in',
  roleGuard('manager', 'cashier'),
  validate([
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'mobile_wallet']).withMessage('Valid payment method is required'),
    body('customerName').optional().isString(),
    body('discount').optional().isNumeric(),
    body('notes').optional().isString(),
  ]),
  cafeController.createWalkInOrder,
);

module.exports = router;
