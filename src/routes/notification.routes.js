const { Router } = require('express');
const { notificationController } = require('../controllers');
const auth = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');

const router = Router();

router.use(auth);
router.use(orgScope);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/archive-all-read', notificationController.archiveAllRead);
router.delete('/archived', notificationController.deleteAllArchived);
router.put('/:id/read', notificationController.markAsRead);
router.put('/:id/archive', notificationController.archiveNotification);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
