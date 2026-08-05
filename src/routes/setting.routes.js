const { Router } = require('express');
const { settingController } = require('../controllers');
const auth = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const roleGuard = require('../middleware/roleGuard');

const router = Router();

router.use(auth);
router.use(roleGuard(ROLES.SUPER_ADMIN, ROLES.MANAGER));

router.get('/', settingController.getSettings);
router.get('/:key', settingController.getSettingByKey);
router.put('/', settingController.updateSettings);

module.exports = router;