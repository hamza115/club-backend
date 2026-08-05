const { Table, ActivityLog } = require('../models');
const { TABLE_STATUS } = require('../config/constants');
const { AppResponse } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');
const { emitToOrg } = require('../socket');

const getTables = asyncHandler(async (req, res) => {
  const filter = { organizationId: req.orgId };
  if (req.query.status) filter.status = req.query.status;

  const tables = await Table.find(filter)
    .sort({ tableNumber: 1 })
    .populate('currentSession', 'customer status startTime pricingMethod hourlyRate frameRate perMinuteRate pausedAt totalPausedDuration')
    .populate({ path: 'currentSession', populate: { path: 'customer', select: 'name' } });

  AppResponse.success(res, { data: { tables } });
});

const getTable = asyncHandler(async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, organizationId: req.orgId })
    .populate('currentSession', 'customer status startTime pricingMethod hourlyRate frameRate perMinuteRate pausedAt totalPausedDuration')
    .populate({ path: 'currentSession', populate: { path: 'customer', select: 'name phone' } });

  if (!table) {
    return AppResponse.error(res, { message: 'Table not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: { table } });
});

const createTable = asyncHandler(async (req, res) => {
  const table = await Table.create({ ...req.body, organizationId: req.orgId });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Table created',
    module: 'table',
    details: `Created table #${table.tableNumber}`,
    resourceId: table._id,
    resourceModel: 'Table',
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'table:created', { table });

  AppResponse.created(res, { data: { table } });
});

const updateTable = asyncHandler(async (req, res) => {
  const table = await Table.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.orgId },
    req.body,
    { new: true, runValidators: true },
  );

  if (!table) {
    return AppResponse.error(res, { message: 'Table not found', statusCode: 404 });
  }

  emitToOrg(req.app.get('io'), req.orgId, 'table:updated', { table });

  AppResponse.success(res, { data: { table }, message: 'Table updated' });
});

const deleteTable = asyncHandler(async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!table) {
    return AppResponse.error(res, { message: 'Table not found', statusCode: 404 });
  }

  if (table.status === TABLE_STATUS.OCCUPIED) {
    return AppResponse.error(res, { message: 'Cannot delete an occupied table', statusCode: 400 });
  }

  await table.deleteOne();

  await ActivityLog.create({
    user: req.user._id,
    action: 'Table deleted',
    module: 'table',
    details: `Deleted table #${table.tableNumber}`,
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'table:deleted', { tableId: table._id });

  AppResponse.success(res, { message: 'Table deleted' });
});

const setTableStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const table = await Table.findOne({ _id: req.params.id, organizationId: req.orgId });

  if (!table) {
    return AppResponse.error(res, { message: 'Table not found', statusCode: 404 });
  }

  if (status === TABLE_STATUS.OCCUPIED && !table.currentSession) {
    return AppResponse.error(res, { message: 'Cannot set table to occupied without an active session', statusCode: 400 });
  }

  table.status = status;
  await table.save();

  emitToOrg(req.app.get('io'), req.orgId, 'table:updated', { table });

  AppResponse.success(res, { data: { table }, message: `Table status set to ${status}` });
});

module.exports = { getTables, getTable, createTable, updateTable, deleteTable, setTableStatus };
