const { User, ActivityLog } = require('../models');
const { AppResponse, parsePagination } = require('../utils');
const { notificationService } = require('../services');
const asyncHandler = require('../middleware/asyncHandler');
const { emitToUser } = require('../socket');

const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { organizationId: req.orgId };

  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: { users }, pagination: { page, limit, total } });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!user) {
    return AppResponse.error(res, { message: 'User not found', statusCode: 404 });
  }
  AppResponse.success(res, { data: { user } });
});

const updateUser = asyncHandler(async (req, res) => {
  const { password, role, organizationId, ...updateData } = req.body;
  const user = await User.findOne({ _id: req.params.id, organizationId: req.orgId });

  if (!user) {
    return AppResponse.error(res, { message: 'User not found', statusCode: 404 });
  }

  const allowedFields = ['name', 'phone', 'email', 'isActive'];
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      user[field] = updateData[field];
    }
  }
  if (password) user.password = password;
  await user.save();

  if (user.isActive === false) {
    emitToUser(req.app.get('io'), req.orgId, user._id, 'user:deactivated', { userId: user._id });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'User updated',
    module: 'user',
    details: `Updated user: ${user.name}`,
    resourceId: user._id,
    resourceModel: 'User',
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: { user: user.toJSON() }, message: 'User updated' });
});

const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    return AppResponse.error(res, { message: 'Cannot delete your own account', statusCode: 400 });
  }

  const user = await User.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!user) {
    return AppResponse.error(res, { message: 'User not found', statusCode: 404 });
  }

  user.isActive = false;
  await user.save();

  emitToUser(req.app.get('io'), req.orgId, user._id, 'user:deactivated', { userId: user._id });

  await ActivityLog.create({
    user: req.user._id,
    action: 'User deactivated',
    module: 'user',
    details: `Deactivated user: ${user.name}`,
    resourceId: user._id,
    resourceModel: 'User',
    ipAddress: req.ip,
  });

  await notificationService.notifyAccountLocked(user, req.orgId, req.app.get('io'));

  AppResponse.success(res, { message: 'User deactivated' });
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!user) {
    return AppResponse.error(res, { message: 'User not found', statusCode: 404 });
  }

  user.password = req.body.newPassword;
  await user.save();

  await ActivityLog.create({
    user: req.user._id,
    action: 'User password reset',
    module: 'user',
    details: `Reset password for: ${user.name}`,
    resourceId: user._id,
    resourceModel: 'User',
    ipAddress: req.ip,
  });

  await notificationService.notifyPasswordChanged(user, req.orgId, req.app.get('io'));

  AppResponse.success(res, { message: 'Password reset successfully' });
});

module.exports = { getUsers, getUser, updateUser, deleteUser, resetUserPassword };
