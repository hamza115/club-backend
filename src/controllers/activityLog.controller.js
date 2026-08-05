const { ActivityLog } = require('../models');
const { AppResponse, parsePagination } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');

const getLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  if (req.query.module) filter.module = req.query.module;
  if (req.query.user) filter.user = req.query.user;
  if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email role'),
    ActivityLog.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: logs, pagination: { page, limit, total } });
});

module.exports = { getLogs };