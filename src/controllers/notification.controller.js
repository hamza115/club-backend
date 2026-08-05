const { Notification } = require('../models');
const { AppResponse, parsePagination } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');

const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { organizationId: req.orgId, isArchived: false };

  if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
  if (req.query.type) filter.type = req.query.type;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.priority) filter.priority = req.query.priority;

  if (req.user.role !== 'super_admin') {
    const nonAdminCategories = ['inventory', 'session', 'payment', 'cafe', 'system'];
    filter.category = req.query.category
      ? (nonAdminCategories.includes(req.query.category) ? req.query.category : undefined)
      : { $in: nonAdminCategories };
    filter.recipient = { $in: [req.user._id, null] };
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  const unreadFilter = { isRead: false, isArchived: false, organizationId: req.orgId };
  if (req.user.role !== 'super_admin') {
    unreadFilter.recipient = { $in: [req.user._id, null] };
    unreadFilter.category = { $in: ['inventory', 'session', 'payment', 'cafe', 'system'] };
  }
  const unreadCount = await Notification.countDocuments(unreadFilter);

  AppResponse.paginated(res, {
    data: notifications,
    pagination: { page, limit, total },
    meta: { unreadCount },
  });
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const filter = { isRead: false, isArchived: false, organizationId: req.orgId };

  if (req.user.role !== 'super_admin') {
    filter.recipient = { $in: [req.user._id, null] };
    filter.category = { $in: ['inventory', 'session', 'payment', 'cafe', 'system'] };
  }

  const count = await Notification.countDocuments(filter);

  AppResponse.success(res, { data: { unreadCount: count } });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.orgId },
    { isRead: true, readAt: new Date() },
    { new: true },
  );

  if (!notification) {
    return AppResponse.error(res, { message: 'Notification not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: { notification }, message: 'Marked as read' });
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const filter = { isRead: false, isArchived: false, organizationId: req.orgId };

  if (req.user.role !== 'super_admin') {
    filter.recipient = { $in: [req.user._id, null] };
    filter.category = { $in: ['inventory', 'session', 'payment', 'cafe', 'system'] };
  }

  await Notification.updateMany(filter, { isRead: true, readAt: new Date() });

  AppResponse.success(res, { message: 'All notifications marked as read' });
});

const archiveNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.orgId },
    { isArchived: true, archivedAt: new Date() },
    { new: true },
  );

  if (!notification) {
    return AppResponse.error(res, { message: 'Notification not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: { notification }, message: 'Notification archived' });
});

const archiveAllRead = asyncHandler(async (req, res) => {
  const filter = { isRead: true, isArchived: false, organizationId: req.orgId };

  if (req.user.role !== 'super_admin') {
    filter.recipient = { $in: [req.user._id, null] };
  }

  await Notification.updateMany(filter, { isArchived: true, archivedAt: new Date() });

  AppResponse.success(res, { message: 'All read notifications archived' });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    organizationId: req.orgId,
  });

  if (!notification) {
    return AppResponse.error(res, { message: 'Notification not found', statusCode: 404 });
  }

  AppResponse.success(res, { message: 'Notification deleted' });
});

const deleteAllArchived = asyncHandler(async (req, res) => {
  const filter = { isArchived: true, organizationId: req.orgId };

  if (req.user.role !== 'super_admin') {
    filter.recipient = { $in: [req.user._id, null] };
  }

  await Notification.deleteMany(filter);

  AppResponse.success(res, { message: 'All archived notifications deleted' });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  archiveAllRead,
  deleteNotification,
  deleteAllArchived,
};
