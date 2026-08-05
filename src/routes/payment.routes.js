const { Router } = require('express');
const { paymentController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth);
router.use(orgScope);

router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPayment);

router.post(
  '/',
  validate([
    body('sessionId').notEmpty().withMessage('Session ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('method').isIn(['cash', 'card', 'bank_transfer', 'mobile_wallet']).withMessage('Valid payment method is required'),
  ]),
  paymentController.recordPayment,
);

module.exports = router;