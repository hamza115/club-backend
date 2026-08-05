const { Router } = require('express');
const { expenseController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const roleGuard = require('../middleware/roleGuard');
const { validate, body } = require('../middleware/validate');
const { EXPENSE_CATEGORIES, PAYMENT_METHOD, EXPENSE_STATUS, EXPENSE_RECURRENCE } = require('../config/constants');

const router = Router();

router.use(auth);
router.use(orgScope);
router.use(roleGuard('super_admin', 'manager'));

router.get('/', expenseController.getExpenses);
router.get('/:id', expenseController.getExpense);

router.post(
  '/',
  validate([
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
    body('category').isIn(EXPENSE_CATEGORIES).withMessage('Valid category is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').isIn(Object.values(PAYMENT_METHOD)).withMessage('Valid payment method is required'),
    body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 500 }),
    body('date').optional({ values: 'falsy' }).isISO8601().withMessage('Valid date is required'),
    body('vendor').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
    body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
    body('status').optional({ values: 'falsy' }).isIn(Object.values(EXPENSE_STATUS)).withMessage('Valid status is required'),
    body('isRecurring').optional({ values: 'falsy' }).isBoolean().withMessage('isRecurring must be a boolean'),
    body('recurrenceFrequency').optional({ values: 'falsy' }).isIn(Object.values(EXPENSE_RECURRENCE)).withMessage('Valid recurrence frequency is required'),
  ]),
  expenseController.createExpense,
);

router.put(
  '/:id',
  validate([
    body('title').optional({ values: 'falsy' }).trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 120 }),
    body('category').optional({ values: 'falsy' }).isIn(EXPENSE_CATEGORIES).withMessage('Valid category is required'),
    body('amount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').optional({ values: 'falsy' }).isIn(Object.values(PAYMENT_METHOD)).withMessage('Valid payment method is required'),
    body('description').optional({ values: 'falsy' }).trim().notEmpty().withMessage('Description cannot be empty').isLength({ max: 500 }),
    body('date').optional({ values: 'falsy' }).isISO8601(),
    body('vendor').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
    body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
    body('isRecurring').optional({ values: 'falsy' }).isBoolean(),
    body('recurrenceFrequency').optional({ values: 'falsy' }).isIn(Object.values(EXPENSE_RECURRENCE)),
  ]),
  expenseController.updateExpense,
);

router.put('/:id/approve', expenseController.approveExpense);
router.put('/:id/reject', expenseController.rejectExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
