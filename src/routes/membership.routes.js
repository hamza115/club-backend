const { Router } = require('express');
const { membershipController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth);
router.use(orgScope);

router.get('/', membershipController.getMemberships);
router.get('/:id', membershipController.getMembership);

router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Membership name is required'),
    body('tier').isIn(['silver', 'gold', 'vip']).withMessage('Tier must be silver, gold, or vip'),
    body('discount').isInt({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
    body('validityDays').isInt({ min: 1 }).withMessage('Validity days must be at least 1'),
  ]),
  membershipController.createMembership,
);

router.put('/:id', membershipController.updateMembership);
router.delete('/:id', membershipController.deleteMembership);

module.exports = router;