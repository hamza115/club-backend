const { Router } = require('express');
const { userController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { ROLES } = require('../config/constants');
const roleGuard = require('../middleware/roleGuard');
const { validate, body } = require('../middleware/validate');

const router = Router();

router.use(auth, orgScope, roleGuard(ROLES.SUPER_ADMIN));

router.get('/', userController.getUsers);
router.get('/:id', userController.getUser);

router.put('/:id', userController.updateUser);
router.post('/:id/reset-password', userController.resetUserPassword);
router.delete('/:id', userController.deleteUser);

module.exports = router;
