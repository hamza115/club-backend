const { Session, ActivityLog, Table } = require('../models');
const { sessionService, billingService, notificationService } = require('../services');
const { AppResponse, parsePagination } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');
const { emitToOrg } = require('../socket');

const getSessions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { organizationId: req.orgId };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.table) filter.table = req.query.table;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.groupId) filter.groupId = req.query.groupId;

  const [sessions, total] = await Promise.all([
    Session.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name phone')
      .populate('table', 'tableNumber')
      .populate('createdBy', 'name')
      .populate('endedBy', 'name'),
    Session.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: sessions, pagination: { page, limit, total } });
});

const getActiveSessions = asyncHandler(async (req, res) => {
  const filter = {
    organizationId: req.orgId,
    status: { $in: ['active', 'paused'] },
  };

  const sessions = await Session.find(filter)
    .sort({ createdAt: -1 })
    .populate('customer', 'name phone')
    .populate('table', 'tableNumber hourlyRate frameRate perMinuteRate')
    .populate('createdBy', 'name');

  const sessionsWithCharges = sessions.map((session) => {
    const obj = session.toObject();
    obj.runningCharges = sessionService.getRunningCharges(session);
    return obj;
  });

  // Also find occupied tables with no active/paused session (completed sessions within active groups)
  // so the Active tab on the frontend can show them
  const occupiedTablesWithNoActiveSession = await Table.find({
    organizationId: req.orgId,
    status: 'occupied',
    currentSession: null,
    currentGroupId: { $ne: null },
  });

  const orphanedGroupIds = occupiedTablesWithNoActiveSession.map((t) => t.currentGroupId);

  if (orphanedGroupIds.length > 0) {
    // Find the latest session for each orphaned group
    const orphanedSessions = await Session.find({
      organizationId: req.orgId,
      groupId: { $in: orphanedGroupIds },
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .populate('customer', 'name phone')
      .populate('table', 'tableNumber hourlyRate frameRate perMinuteRate')
      .populate('createdBy', 'name');

    // Only include the latest session per group (to avoid duplicates)
    const seenGroups = new Set();
    for (const os of orphanedSessions) {
      if (!seenGroups.has(os.groupId)) {
        seenGroups.add(os.groupId);
        const obj = os.toObject();
        obj.runningCharges = sessionService.getRunningCharges(os);
        sessionsWithCharges.push(obj);
      }
    }
  }

  AppResponse.success(res, { data: sessionsWithCharges });
});

const getSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    organizationId: req.orgId,
  })
    .populate('customer', 'name phone')
    .populate('table', 'tableNumber hourlyRate frameRate perMinuteRate')
    .populate('createdBy', 'name')
    .populate('endedBy', 'name')
    .populate('cafeItems.product', 'name category');

  if (!session) {
    return AppResponse.error(res, { message: 'Session not found', statusCode: 404 });
  }

  const runningCharges = sessionService.getRunningCharges(session);

  AppResponse.success(res, { data: { session, runningCharges } });
});

const startSession = asyncHandler(async (req, res) => {
  const {
    customerId,
    customerName,
    customerPhone,
    tableId,
    pricingMethod,
    hourlyRate,
    frameRate,
    customRate,
    perMinuteRate,
    notes,
    groupId,
  } = req.body;

  const session = await sessionService.startSession({
    organizationId: req.orgId,
    customerId,
    customerName,
    customerPhone,
    tableId,
    pricingMethod,
    hourlyRate,
    frameRate,
    customRate,
    perMinuteRate,
    notes,
    createdBy: req.user._id,
    groupId,
  });

  const populated = await Session.findById(session._id)
    .populate('customer', 'name phone')
    .populate('table', 'tableNumber hourlyRate frameRate perMinuteRate');

  await ActivityLog.create({
    user: req.user._id,
    action: 'Session started',
    module: 'session',
    details: `Started session for customer on table`,
    resourceId: session._id,
    resourceModel: 'Session',
    ipAddress: req.ip,
  });

  const sessionData = populated.toObject();
  sessionData.runningCharges = 0;
  emitToOrg(req.app.get('io'), req.orgId, 'session:started', { session: sessionData });

  await notificationService.notifySessionStarted(populated, req.orgId, req.app.get('io'));

  AppResponse.created(res, { data: { session: populated }, message: 'Session started' });
});

const pauseSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    organizationId: req.orgId,
  });
  if (!session) {
    return AppResponse.error(res, { message: 'Session not found', statusCode: 404 });
  }

  const updated = await sessionService.pauseSession(req.params.id);

  await ActivityLog.create({
    user: req.user._id,
    action: 'Session paused',
    module: 'session',
    resourceId: updated._id,
    resourceModel: 'Session',
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'session:paused', {
    sessionId: updated._id,
    pausedAt: updated.pausedAt,
  });

  await notificationService.notifySessionPaused(updated, req.orgId, req.app.get('io'));

  AppResponse.success(res, { data: { session: updated }, message: 'Session paused' });
});

const resumeSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    organizationId: req.orgId,
  });
  if (!session) {
    return AppResponse.error(res, { message: 'Session not found', statusCode: 404 });
  }

  const updated = await sessionService.resumeSession(req.params.id);

  await ActivityLog.create({
    user: req.user._id,
    action: 'Session resumed',
    module: 'session',
    resourceId: updated._id,
    resourceModel: 'Session',
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'session:resumed', {
    sessionId: updated._id,
    totalPausedDuration: updated.totalPausedDuration,
  });

  await notificationService.notifySessionResumed(updated, req.orgId, req.app.get('io'));

  AppResponse.success(res, { data: { session: updated }, message: 'Session resumed' });
});

const endSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    organizationId: req.orgId,
  });
  if (!session) {
    return AppResponse.error(res, { message: 'Session not found', statusCode: 404 });
  }

  const { totalFrames, discount, discountReason } = req.body;

  const ended = await sessionService.endSession(req.params.id, {
    totalFrames,
    discount,
    discountReason,
    endedBy: req.user._id,
  });

  const populated = await Session.findById(ended._id)
    .populate('customer', 'name phone')
    .populate('table', 'tableNumber');

  await ActivityLog.create({
    user: req.user._id,
    action: 'Session ended',
    module: 'session',
    details: `Ended session. Total: ${ended.finalAmount}`,
    resourceId: ended._id,
    resourceModel: 'Session',
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'session:ended', {
    sessionId: ended._id,
    tableId: ended.table,
    finalAmount: ended.finalAmount,
    groupId: ended.groupId,
  });

  await notificationService.notifySessionEnded(ended, req.orgId, req.app.get('io'));

  if (ended.paymentStatus === 'pending') {
    await notificationService.notifyPendingPayment(ended, req.orgId, req.app.get('io'));
  } else if (ended.paymentStatus === 'partial') {
    await notificationService.notifyPaymentPartial(ended, req.orgId, req.app.get('io'));
  }

  AppResponse.success(res, { data: { session: populated }, message: 'Session ended' });
});

// ── Group endpoints ──

const getGroupSessions = asyncHandler(async (req, res) => {
  const groupData = await sessionService.getGroupSessions(req.params.groupId, req.orgId);

  if (!groupData.sessions || groupData.sessions.length === 0) {
    return AppResponse.error(res, { message: 'Group not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: groupData });
});

const addSessionToGroup = asyncHandler(async (req, res) => {
  const { pricingMethod, hourlyRate, frameRate, customRate, perMinuteRate, notes } = req.body;

  const groupData = await sessionService.getGroupSessions(req.params.groupId, req.orgId);
  if (!groupData.sessions || groupData.sessions.length === 0) {
    return AppResponse.error(res, { message: 'Group not found', statusCode: 404 });
  }

  const tableId = groupData.table._id;

  const session = await sessionService.addSessionToGroup({
    organizationId: req.orgId,
    groupId: req.params.groupId,
    tableId,
    pricingMethod,
    hourlyRate,
    frameRate,
    customRate,
    perMinuteRate,
    notes,
    createdBy: req.user._id,
  });

  const populated = await Session.findById(session._id)
    .populate('customer', 'name phone')
    .populate('table', 'tableNumber hourlyRate frameRate perMinuteRate');

  await ActivityLog.create({
    user: req.user._id,
    action: 'Session added to group',
    module: 'session',
    details: `Added session to group ${req.params.groupId}`,
    resourceId: session._id,
    resourceModel: 'Session',
    ipAddress: req.ip,
  });

  const sessionData = populated.toObject();
  sessionData.runningCharges = 0;
  emitToOrg(req.app.get('io'), req.orgId, 'session:started', { session: sessionData });

  AppResponse.created(res, { data: { session: populated }, message: 'Session added to group' });
});

const finishGroup = asyncHandler(async (req, res) => {
  const groupData = await sessionService.finishGroup(req.params.groupId, req.orgId, req.user._id);

  await ActivityLog.create({
    user: req.user._id,
    action: 'Group finished',
    module: 'session',
    details: `Finished group ${req.params.groupId}. Total: ${groupData.totals.totalAmount}`,
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'group:finished', {
    groupId: req.params.groupId,
    tableId: groupData.table?._id,
    totalAmount: groupData.totals.totalAmount,
  });

  AppResponse.success(res, { data: groupData, message: 'Group finished' });
});

const checkoutGroup = asyncHandler(async (req, res) => {
  const { paymentMethod, amountPaid, discount, discountReason } = req.body;

  const groupData = await sessionService.checkoutGroup(req.params.groupId, req.orgId, {
    paymentMethod,
    amountPaid,
    discount,
    discountReason,
  });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Group checkout',
    module: 'session',
    details: `Checked out group ${req.params.groupId}. Payment: ${paymentMethod}`,
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'group:checkout', {
    groupId: req.params.groupId,
    tableId: groupData.table?._id,
    paymentMethod,
  });

  // Emit session:ended for each session so the frontend removes them from active list
  for (const gs of groupData.sessions || []) {
    emitToOrg(req.app.get('io'), req.orgId, 'session:ended', {
      sessionId: gs._id,
      tableId: groupData.table?._id,
      groupId: req.params.groupId,
    });
  }

  // Emit table:updated so the tables page refreshes with the freed table
  if (groupData.table) {
    emitToOrg(req.app.get('io'), req.orgId, 'table:updated', {
      table: {
        _id: groupData.table._id,
        tableNumber: groupData.table.tableNumber,
        status: 'available',
        currentSession: null,
        currentGroupId: null,
        currentCustomerId: null,
      },
    });
  }

  AppResponse.success(res, { data: groupData, message: 'Group checked out' });
});

const addCafeItems = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    organizationId: req.orgId,
  });
  if (!session) {
    return AppResponse.error(res, { message: 'Session not found', statusCode: 404 });
  }

  const updated = await billingService.addCafeItemsToSession(session, req.body.items, req.user._id);

  await ActivityLog.create({
    user: req.user._id,
    action: 'Cafe items added to session',
    module: 'cafe',
    resourceId: session._id,
    resourceModel: 'Session',
    ipAddress: req.ip,
  });

  emitToOrg(req.app.get('io'), req.orgId, 'session:updated', {
    sessionId: updated._id,
    cafeCharges: updated.cafeCharges,
  });

  AppResponse.success(res, { data: { session: updated }, message: 'Items added to session' });
});

const removeCafeItem = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    organizationId: req.orgId,
  });
  if (!session) {
    return AppResponse.error(res, { message: 'Session not found', statusCode: 404 });
  }

  const updated = await billingService.removeCafeItem(session, req.params.itemId, req.user._id);

  emitToOrg(req.app.get('io'), req.orgId, 'session:updated', {
    sessionId: updated._id,
    cafeCharges: updated.cafeCharges,
  });

  AppResponse.success(res, { data: { session: updated }, message: 'Item removed from session' });
});

module.exports = {
  getSessions, getActiveSessions, getSession, startSession, pauseSession, resumeSession,
  endSession, getGroupSessions, addSessionToGroup, finishGroup, checkoutGroup,
  addCafeItems, removeCafeItem,
};
