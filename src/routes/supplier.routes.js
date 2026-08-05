const { Router } = require('express');
const { supplierController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const roleGuard = require('../middleware/roleGuard');
const { ROLES } = require('../config/constants');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth, orgScope);

router.get('/', supplierController.getSuppliers);

router.post(
  '/',
  roleGuard(ROLES.SUPER_ADMIN),
  validate([
    body('name').trim().notEmpty().withMessage('Supplier name is required'),
    body('contactNumber').trim().notEmpty().withMessage('Contact number is required'),
    body('note').optional().isString(),
  ]),
  supplierController.createSupplier,
);

router.put(
  '/:id',
  roleGuard(ROLES.SUPER_ADMIN),
  validate([
    body('name').optional().trim().notEmpty().withMessage('Supplier name cannot be empty'),
    body('contactNumber').optional().trim().notEmpty().withMessage('Contact number cannot be empty'),
    body('note').optional().isString(),
    body('isActive').optional().isBoolean(),
  ]),
  supplierController.updateSupplier,
);

router.delete('/:id', roleGuard(ROLES.SUPER_ADMIN), supplierController.deleteSupplier);

module.exports = router;
