const crypto = require('crypto');
const { User, Organization, ActivityLog } = require('../models');
const { authService, notificationService } = require('../services');
const { AppResponse, logger } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');
const { ROLES } = require('../config/constants');

function generateOrgId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ORG-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password').populate('organizationId', 'name orgId currency');
  if (!user || !(await user.comparePassword(password))) {
    await notificationService.notifyFailedLogin(email, null, null);
    return AppResponse.error(res, { message: 'Invalid email or password', statusCode: 401 });
  }

  if (!user.isActive) {
    return AppResponse.error(res, { message: 'Account has been deactivated', statusCode: 403 });
  }

  const token = authService.generateToken(user._id, user.role, user.organizationId?._id || user.organizationId);
  const refreshToken = authService.generateRefreshToken(user._id, user.role, user.organizationId?._id || user.organizationId);

  user.lastLogin = new Date();
  await user.save();

  await ActivityLog.create({
    user: user._id,
    action: 'User logged in',
    module: 'auth',
    details: `${user.name} (${user.role}) logged in`,
    ipAddress: req.ip,
  });

  const userData = user.toJSON();
  userData.organization = user.organizationId;

  AppResponse.success(res, {
    data: {
      user: userData,
      token,
      refreshToken,
    },
    message: 'Login successful',
  });
});

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return AppResponse.error(res, { message: 'Email already registered', statusCode: 409 });
  }

  // Generate unique org ID
  let orgId;
  let existingOrg;
  do {
    orgId = generateOrgId();
    existingOrg = await Organization.findOne({ orgId });
  } while (existingOrg);

  // Create organization with auto-generated name
  const org = await Organization.create({
    name: `${name}'s Club`,
    orgId,
    owner: null, // will set after user creation
  });

  // Create admin user with organization
  const user = await User.create({
    name,
    email,
    password,
    role: ROLES.SUPER_ADMIN,
    phone,
    organizationId: org._id,
  });

  // Set owner reference
  org.owner = user._id;
  await org.save();

  await ActivityLog.create({
    user: user._id,
    action: 'New organization registered',
    module: 'auth',
    details: `${user.name} registered organization "${org.name}" (${org.orgId})`,
    ipAddress: req.ip,
  });

  const token = authService.generateToken(user._id, user.role, org._id);
  const userData = user.toJSON();
  userData.organization = org;

  AppResponse.created(res, {
    data: { user: userData, token },
    message: 'Organization and admin account created successfully',
  });
});

const createStaff = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!Object.values([ROLES.MANAGER, ROLES.CASHIER]).includes(role)) {
    return AppResponse.error(res, { message: 'Can only create manager or cashier accounts', statusCode: 400 });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return AppResponse.error(res, { message: 'Email already registered', statusCode: 409 });
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    organizationId: req.user.organizationId,
  });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Staff account created',
    module: 'user',
    details: `${req.user.name} created ${role} account for ${name}`,
    ipAddress: req.ip,
  });

  await notificationService.notifyUserCreated(user, req.user.name, req.orgId, req.app.get('io'));

  AppResponse.created(res, {
    data: { user: user.toJSON() },
    message: `${role} account created successfully`,
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('organizationId', 'name orgId currency');
  const userData = user.toJSON();
  userData.organization = user.organizationId;
  AppResponse.success(res, { data: { user: userData } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();

  AppResponse.success(res, { data: { user: user.toJSON() }, message: 'Profile updated' });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return AppResponse.error(res, { message: 'Current password is incorrect', statusCode: 400 });
  }

  user.password = newPassword;
  await user.save();

  await ActivityLog.create({
    user: user._id,
    action: 'Password changed',
    module: 'auth',
    ipAddress: req.ip,
  });

  await notificationService.notifyPasswordChanged(user, req.orgId, req.app.get('io'));

  AppResponse.success(res, { message: 'Password changed successfully' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select('+resetPasswordToken +resetPasswordExpire');

  if (!user) {
    return AppResponse.success(res, { message: 'If that email exists, a reset link has been sent' });
  }

  const { resetToken, hashedToken, expiresAt } = authService.generateResetToken();

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = expiresAt;
  await user.save();

  logger.info(`Password reset token for ${email}: ${resetToken}`);

  AppResponse.success(res, { message: 'If that email exists, a reset link has been sent' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire');

  if (!user) {
    return AppResponse.error(res, { message: 'Invalid or expired reset token', statusCode: 400 });
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  AppResponse.success(res, { message: 'Password reset successful' });
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return AppResponse.error(res, { message: 'Refresh token is required', statusCode: 400 });
  }

  try {
    const decoded = authService.verifyRefreshToken(token);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return AppResponse.error(res, { message: 'Invalid refresh token', statusCode: 401 });
    }

    const newToken = authService.generateToken(user._id, user.role, user.organizationId);
    const newRefreshToken = authService.generateRefreshToken(user._id, user.role, user.organizationId);

    AppResponse.success(res, {
      data: { token: newToken, refreshToken: newRefreshToken },
    });
  } catch {
    return AppResponse.error(res, { message: 'Invalid refresh token', statusCode: 401 });
  }
});

module.exports = { login, register, createStaff, getProfile, updateProfile, changePassword, forgotPassword, resetPassword, refreshToken };
