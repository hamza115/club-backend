const { Router } = require('express');
const { tableController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const roleGuard = require('../middleware/roleGuard');
const { validate, body } = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = Router();

router.use(auth, orgScope);

router.get('/', tableController.getTables);
router.get('/:id', tableController.getTable);

router.post(
  '/',
  roleGuard(ROLES.SUPER_ADMIN),
  validate([
    body('tableNumber').isInt({ min: 1 }).withMessage('Table number is required'),
  ]),
  tableController.createTable,
);

router.put(
  '/:id',
  roleGuard(ROLES.SUPER_ADMIN),
  tableController.updateTable,
);

router.put(
  '/:id/status',
  tableController.setTableStatus,
);

router.delete(
  '/:id',
  roleGuard(ROLES.SUPER_ADMIN),
  tableController.deleteTable,
);

module.exports = router;
