const { Router } = require('express');
const { cafeController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const roleGuard = require('../middleware/roleGuard');
const { ROLES } = require('../config/constants');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth);
router.use(orgScope);

router.get('/', cafeController.getProducts);
router.get('/categories', cafeController.getCategories);
router.get('/:id', cafeController.getProduct);

router.post(
  '/',
  roleGuard(ROLES.SUPER_ADMIN),
  validate([
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('purchasePrice').isNumeric().withMessage('Purchase price must be a number'),
    body('sellingPrice').isNumeric().withMessage('Selling price must be a number'),
  ]),
  cafeController.createProduct,
);

router.put('/:id', roleGuard(ROLES.SUPER_ADMIN), cafeController.updateProduct);
router.delete('/:id', roleGuard(ROLES.SUPER_ADMIN), cafeController.deleteProduct);

module.exports = router;
