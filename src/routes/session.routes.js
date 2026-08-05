const { Router } = require('express');
const { sessionController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const roleGuard = require('../middleware/roleGuard');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth);
router.use(orgScope);

// List sessions (all org members can view)
router.get('/', sessionController.getSessions);
router.get('/active', sessionController.getActiveSessions);

// Group endpoints
router.get('/group/:groupId', sessionController.getGroupSessions);
router.post(
  '/group/:groupId/add-session',
  roleGuard('manager', 'cashier'),
  validate([
    body('pricingMethod').isIn(['hourly', 'frame', 'custom', 'per_minute']).withMessage('Valid pricing method is required'),
    body('hourlyRate').optional().isNumeric(),
    body('frameRate').optional().isNumeric(),
    body('customRate').optional().isNumeric(),
    body('notes').optional().isString(),
  ]),
  sessionController.addSessionToGroup,
);
router.post(
  '/group/:groupId/finish',
  roleGuard('manager', 'cashier'),
  sessionController.finishGroup,
);
router.post(
  '/group/:groupId/checkout',
  roleGuard('manager', 'cashier'),
  validate([
    body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'mobile_wallet']).withMessage('Valid payment method is required'),
    body('amountPaid').optional().isNumeric(),
    body('discount').optional().isNumeric(),
    body('discountReason').optional().isString(),
  ]),
  sessionController.checkoutGroup,
);

router.get('/:id', sessionController.getSession);

// Start session — manager and cashier only
router.post(
  '/',
  roleGuard('manager', 'cashier'),
  validate([
    body('tableId').notEmpty().withMessage('Table is required'),
    body('pricingMethod').isIn(['hourly', 'frame', 'custom', 'per_minute']).withMessage('Valid pricing method is required'),
    body('customerId').optional().notEmpty(),
    body('customerName').optional().notEmpty(),
    body('customerPhone').optional().isString(),
    body('hourlyRate').optional().isNumeric(),
    body('frameRate').optional().isNumeric(),
    body('customRate').optional().isNumeric(),
    body('notes').optional().isString(),
    body('groupId').optional().isString(),
  ]),
  sessionController.startSession,
);

// Pause / resume — manager and cashier only
router.post('/:id/pause', roleGuard('manager', 'cashier'), sessionController.pauseSession);
router.post('/:id/resume', roleGuard('manager', 'cashier'), sessionController.resumeSession);

// End session — manager and cashier only
router.post(
  '/:id/end',
  roleGuard('manager', 'cashier'),
  validate([
    body('discount').optional().isNumeric(),
    body('discountReason').optional().isString(),
  ]),
  sessionController.endSession,
);

// Cafe items — manager and cashier only
router.post(
  '/:id/cafe-items',
  roleGuard('manager', 'cashier'),
  validate([
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required'),
    body('items.*.quantity').optional().isInt({ min: 1 }),
  ]),
  sessionController.addCafeItems,
);

router.delete('/:id/cafe-items/:itemId', roleGuard('manager', 'cashier'), sessionController.removeCafeItem);

module.exports = router;
