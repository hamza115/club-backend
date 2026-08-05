const { Router } = require('express');
const { customerController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth);
router.use(orgScope);

router.get('/search', customerController.searchCustomers);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomer);
router.get('/:id/history', customerController.getCustomerHistory);

router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
  ]),
  customerController.createCustomer,
);

router.get('/:id/outstanding', customerController.getOutstandingSessions);
router.post(
  '/:id/collect-payment',
  validate([
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('method').optional().isIn(['cash', 'card', 'bank_transfer', 'mobile_wallet']),
  ]),
  customerController.collectPayment,
);
router.post(
  '/:id/wallet',
  validate([
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('type').isIn(['credit', 'debit']).withMessage('Type must be "credit" or "debit"'),
  ]),
  customerController.updateWallet,
);

router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;