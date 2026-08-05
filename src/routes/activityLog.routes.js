const { Router } = require('express');
const { activityLogController } = require('../controllers');
const auth = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const roleGuard = require('../middleware/roleGuard');

const router = Router();

router.use(auth);
router.use(roleGuard(ROLES.SUPER_ADMIN, ROLES.MANAGER));

router.get('/', activityLogController.getLogs);

module.exports = router;