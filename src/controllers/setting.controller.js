const { Setting, ActivityLog } = require('../models');
const { AppResponse } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');

const getSettings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.group) filter.group = req.query.group;

  const settings = await Setting.find(filter).sort({ group: 1, key: 1 });
  AppResponse.success(res, { data: { settings } });
});

const getSettingByKey = asyncHandler(async (req, res) => {
  const setting = await Setting.findOne({ key: req.params.key });
  if (!setting) {
    return AppResponse.error(res, { message: 'Setting not found', statusCode: 404 });
  }
  AppResponse.success(res, { data: { setting } });
});

const updateSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (!Array.isArray(settings)) {
    return AppResponse.error(res, { message: 'Settings must be an array', statusCode: 400 });
  }

  const updated = [];

  for (const item of settings) {
    const setting = await Setting.findOneAndUpdate(
      { key: item.key },
      { value: item.value, updatedBy: req.user._id },
      { new: true, upsert: true },
    );
    updated.push(setting);
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'Settings updated',
    module: 'settings',
    details: `Updated ${settings.length} setting(s)`,
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: { settings: updated }, message: 'Settings updated' });
});

module.exports = { getSettings, getSettingByKey, updateSettings };