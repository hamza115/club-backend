const crypto = require('crypto');
const { Session, Table, Customer } = require('../models');
const { TABLE_STATUS, SESSION_STATUS, PRICING_METHOD } = require('../config/constants');

const startSession = async ({
  organizationId,
  customerId,
  customerName,
  customerPhone,
  tableId,
  pricingMethod,
  hourlyRate,
  frameRate,
  customRate,
  notes,
  createdBy,
  groupId,
}) => {
  const table = await Table.findById(tableId);
  if (!table) throw Object.assign(new Error('Table not found'), { statusCode: 404 });

  // If a groupId is provided, the table is already occupied by this group
  if (!groupId && table.status !== TABLE_STATUS.AVAILABLE) {
    throw Object.assign(new Error(`Table is currently ${table.status}`), { statusCode: 400 });
  }

  let customer;
  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  } else if (customerName) {
    customer = await Customer.create({
      organizationId,
      name: customerName,
      phone: customerPhone || '',
      createdBy,
    });
  } else {
    throw Object.assign(new Error('Customer name is required'), { statusCode: 400 });
  }

  const newGroupId = groupId || crypto.randomUUID();

  const session = await Session.create({
    organizationId,
    groupId: newGroupId,
    customer: customer._id,
    table: tableId,
    pricingMethod,
    hourlyRate: pricingMethod === PRICING_METHOD.HOURLY ? (hourlyRate || table.hourlyRate) : 0,
    frameRate: pricingMethod === PRICING_METHOD.FRAME ? (frameRate || table.frameRate) : 0,
    customRate: pricingMethod === PRICING_METHOD.CUSTOM ? (customRate || 0) : 0,
    perMinuteRate: pricingMethod === PRICING_METHOD.PER_MINUTE ? (table.perMinuteRate || 0) : 0,
    notes: notes || '',
    startTime: new Date(),
    createdBy,
  });

  table.status = TABLE_STATUS.OCCUPIED;
  table.currentSession = session._id;
  table.currentGroupId = newGroupId;
  table.currentCustomerId = customer._id;
  await table.save();

  return session;
};

const addSessionToGroup = async ({
  organizationId,
  groupId,
  tableId,
  pricingMethod,
  hourlyRate,
  frameRate,
  customRate,
  notes,
  createdBy,
}) => {
  const table = await Table.findById(tableId);
  if (!table) throw Object.assign(new Error('Table not found'), { statusCode: 404 });
  if (table.currentGroupId !== groupId) {
    throw Object.assign(new Error('Group does not belong to this table'), { statusCode: 400 });
  }

  // Check there is no active session in the group
  const activeSession = await Session.findOne({
    groupId,
    status: { $in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.PAUSED] },
  });
  if (activeSession) {
    throw Object.assign(new Error('Cannot add session while an active session exists in the group'), { statusCode: 400 });
  }

  const customer = await Customer.findById(table.currentCustomerId);
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  const session = await Session.create({
    organizationId,
    groupId,
    customer: customer._id,
    table: tableId,
    pricingMethod,
    hourlyRate: pricingMethod === PRICING_METHOD.HOURLY ? (hourlyRate || table.hourlyRate) : 0,
    frameRate: pricingMethod === PRICING_METHOD.FRAME ? (frameRate || table.frameRate) : 0,
    customRate: pricingMethod === PRICING_METHOD.CUSTOM ? (customRate || 0) : 0,
    perMinuteRate: pricingMethod === PRICING_METHOD.PER_MINUTE ? (table.perMinuteRate || 0) : 0,
    notes: notes || '',
    startTime: new Date(),
    createdBy,
  });

  table.currentSession = session._id;
  await table.save();

  return session;
};

const pauseSession = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.status !== SESSION_STATUS.ACTIVE) {
    throw Object.assign(new Error('Only active sessions can be paused'), { statusCode: 400 });
  }

  session.status = SESSION_STATUS.PAUSED;
  session.pausedAt = new Date();
  await session.save();

  return session;
};

const resumeSession = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.status !== SESSION_STATUS.PAUSED) {
    throw Object.assign(new Error('Only paused sessions can be resumed'), { statusCode: 400 });
  }

  const pausedDuration = Date.now() - session.pausedAt.getTime();
  session.totalPausedDuration += pausedDuration;
  session.status = SESSION_STATUS.ACTIVE;
  session.pausedAt = null;
  await session.save();

  return session;
};

const getRunningCharges = (session) => {
  if (session.status !== SESSION_STATUS.ACTIVE && session.status !== SESSION_STATUS.PAUSED) {
    return session.tableCharges;
  }

  const now = new Date();
  let effectiveDuration = now - session.startTime.getTime();

  if (session.status === SESSION_STATUS.PAUSED && session.pausedAt) {
    effectiveDuration = session.pausedAt.getTime() - session.startTime.getTime();
  }
  effectiveDuration -= session.totalPausedDuration;

  const hoursPlayed = Math.max(0, effectiveDuration / (1000 * 60 * 60));
  const minutesPlayed = Math.max(0, effectiveDuration / (1000 * 60));

  let charges = 0;
  if (session.pricingMethod === PRICING_METHOD.HOURLY) {
    charges = Math.floor(hoursPlayed * session.hourlyRate);
  } else if (session.pricingMethod === PRICING_METHOD.FRAME) {
    charges = session.totalFrames * session.frameRate;
  } else if (session.pricingMethod === PRICING_METHOD.CUSTOM) {
    charges = session.customRate;
  } else if (session.pricingMethod === PRICING_METHOD.PER_MINUTE) {
    charges = Math.floor(minutesPlayed * session.perMinuteRate);
  }

  return charges;
};

const endSession = async (sessionId, { totalFrames, discount, discountReason, endedBy }) => {
  const session = await Session.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  if (session.status === SESSION_STATUS.COMPLETED) {
    throw Object.assign(new Error('Session is already completed'), { statusCode: 400 });
  }

  // If paused, accumulate the final pause duration
  if (session.status === SESSION_STATUS.PAUSED && session.pausedAt) {
    const pausedDuration = Date.now() - session.pausedAt.getTime();
    session.totalPausedDuration += pausedDuration;
    session.pausedAt = null;
  }

  session.endTime = new Date();

  const effectiveDuration = session.endTime - session.startTime.getTime() - session.totalPausedDuration;
  session.totalPlayingTime = Math.max(0, effectiveDuration);

  if (totalFrames !== undefined) {
    session.totalFrames = totalFrames;
  } else if (session.pricingMethod === PRICING_METHOD.FRAME && !session.totalFrames) {
    // A frame-based session represents one billed frame when it is completed.
    session.totalFrames = 1;
  }

  const hoursPlayed = session.totalPlayingTime / (1000 * 60 * 60);
  const minutesPlayed = session.totalPlayingTime / (1000 * 60);

  let tableCharges = 0;
  if (session.pricingMethod === PRICING_METHOD.HOURLY) {
    tableCharges = Math.floor(hoursPlayed * session.hourlyRate);
  } else if (session.pricingMethod === PRICING_METHOD.FRAME) {
    tableCharges = session.totalFrames * session.frameRate;
  } else if (session.pricingMethod === PRICING_METHOD.CUSTOM) {
    tableCharges = session.customRate;
  } else if (session.pricingMethod === PRICING_METHOD.PER_MINUTE) {
    tableCharges = Math.floor(minutesPlayed * session.perMinuteRate);
  }

  session.tableCharges = tableCharges;
  session.cafeCharges = session.cafeItems.reduce((sum, item) => sum + item.subtotal, 0);
  session.subtotal = session.tableCharges + session.cafeCharges;
  session.discount = discount || 0;
  session.discountReason = discountReason || '';
  session.finalAmount = Math.max(0, session.subtotal - session.discount);
  session.status = SESSION_STATUS.COMPLETED;
  session.endedBy = endedBy;

  await session.save();

  // If session has no groupId (legacy), free the table immediately
  // Otherwise, the table stays occupied until the group is finished
  const table = await Table.findById(session.table);
  if (table) {
    if (!session.groupId) {
      table.status = TABLE_STATUS.AVAILABLE;
      table.currentSession = null;
      table.currentGroupId = null;
      table.currentCustomerId = null;
      await table.save();
    } else if (String(table.currentSession) === String(session._id)) {
      table.currentSession = null;
      await table.save();
    }
  }

  // Update customer stats for legacy sessions (no groupId)
  if (!session.groupId) {
    const customer = await Customer.findById(session.customer);
    if (customer) {
      customer.visitCount += 1;
      customer.lifetimeSpending += session.finalAmount;
      customer.lastVisit = new Date();
      if (session.paymentStatus === 'pending') {
        customer.outstandingBalance += session.finalAmount - (session.amountPaid || 0);
      }
      await customer.save();
    }
  }

  return session;
};

const getGroupSessions = async (groupId, organizationId) => {
  const sessions = await Session.find({ groupId, organizationId })
    .sort({ createdAt: 1 })
    .populate('customer', 'name phone')
    .populate('table', 'tableNumber hourlyRate frameRate perMinuteRate')
    .populate('createdBy', 'name')
    .populate('endedBy', 'name')
    .populate('cafeItems.product', 'name category');

  const table = sessions.length > 0 ? await Table.findById(sessions[0].table) : null;

  const totals = sessions.reduce(
    (acc, s) => {
      const charges = s.status === 'completed' ? s.tableCharges : getRunningCharges(s);
      const cafe = s.cafeCharges || 0;
      const cafeItems = s.cafeItems || [];
      acc.totalTableCharges += charges;
      acc.totalCafeCharges += cafe;
      acc.allCafeItems.push(...cafeItems.map((item) => ({ ...item.toObject ? item.toObject() : item, sessionId: s._id })));
      acc.totalDiscount += s.discount || 0;
      acc.totalAmount += charges + cafe - (s.discount || 0);
      acc.totalPaid += s.amountPaid || 0;
      return acc;
    },
    { totalTableCharges: 0, totalCafeCharges: 0, allCafeItems: [], totalDiscount: 0, totalAmount: 0, totalPaid: 0 },
  );

  const hasActiveSession = sessions.some((s) => s.status === 'active' || s.status === 'paused');
  const allCompleted = sessions.every((s) => s.status === 'completed');
  const groupStatus = hasActiveSession ? 'active' : allCompleted ? 'completed' : 'active';

  return {
    groupId,
    table: table ? { _id: table._id, tableNumber: table.tableNumber, status: table.status } : null,
    customer: sessions[0]?.customer || null,
    sessions,
    totals,
    hasActiveSession,
    allCompleted,
    groupStatus,
  };
};

const finishGroup = async (groupId, organizationId, endedBy) => {
  const activeSessions = await Session.find({
    groupId,
    organizationId,
    status: { $in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.PAUSED] },
  });

  for (const session of activeSessions) {
    await endSession(session._id, { endedBy });
  }

  const groupData = await getGroupSessions(groupId, organizationId);

  const table = await Table.findById(groupData.table?._id);
  if (table) {
    table.status = TABLE_STATUS.AVAILABLE;
    table.currentSession = null;
    table.currentGroupId = null;
    table.currentCustomerId = null;
    await table.save();
  }

  // Update customer stats for all sessions in the group
  if (groupData.customer?._id) {
    const customer = await Customer.findById(groupData.customer._id);
    if (customer) {
      const completedSessions = await Session.find({ groupId, organizationId, status: SESSION_STATUS.COMPLETED });
      const totalSpent = completedSessions.reduce((sum, s) => sum + (s.finalAmount || 0), 0);
      customer.visitCount += 1;
      customer.lifetimeSpending += totalSpent;
      customer.lastVisit = new Date();
      const pendingAmount = completedSessions
        .filter((s) => s.paymentStatus === 'pending')
        .reduce((sum, s) => sum + (s.finalAmount - (s.amountPaid || 0)), 0);
      customer.outstandingBalance += pendingAmount;
      await customer.save();
    }
  }

  return groupData;
};

const checkoutGroup = async (groupId, organizationId, { paymentMethod, amountPaid, discount, discountReason }) => {
  const sessions = await Session.find({ groupId, organizationId, status: SESSION_STATUS.COMPLETED });

  if (sessions.length === 0) {
    throw Object.assign(new Error('No completed sessions found in group'), { statusCode: 400 });
  }

  // Apply group-level discount proportionally
  if (discount && discount > 0) {
    const totalSubtotal = sessions.reduce((sum, s) => sum + s.subtotal, 0);
    for (const session of sessions) {
      const proportion = totalSubtotal > 0 ? session.subtotal / totalSubtotal : 1 / sessions.length;
      session.discount = Math.round(discount * proportion);
      session.discountReason = discountReason || '';
      session.finalAmount = Math.max(0, session.subtotal - session.discount);
    }
  }

  // Calculate total due after discount
  const totalDue = sessions.reduce((sum, s) => sum + (s.finalAmount || 0), 0);
  const paidAmount = amountPaid != null && amountPaid > 0 ? Math.min(amountPaid, totalDue) : totalDue;
  const isPartial = paidAmount < totalDue;

  // Allocate payment across sessions proportionally
  let remaining = paidAmount;
  for (const session of sessions) {
    const sessionDue = session.finalAmount;
    const allocation = Math.min(remaining, sessionDue);

    session.paymentMethod = paymentMethod || null;
    session.amountPaid = allocation;

    if (allocation >= sessionDue) {
      session.paymentStatus = 'paid';
    } else {
      session.paymentStatus = 'partial';
    }
    await session.save();
    remaining -= allocation;
  }

  // Free the table — visit is over regardless of payment status
  const tableId = sessions[0].table;
  const table = await Table.findById(tableId);
  const isFirstTimeFinalizing = table && String(table.currentGroupId) === String(groupId);
  if (table) {
    table.status = TABLE_STATUS.AVAILABLE;
    table.currentSession = null;
    table.currentGroupId = null;
    table.currentCustomerId = null;
    await table.save();
  }

  // Update customer stats
  const customerId = sessions[0].customer;
  if (customerId) {
    const customer = await Customer.findById(customerId);
    if (customer) {
      if (isFirstTimeFinalizing) {
        // finishGroup was not called yet, record the visit and spending
        customer.visitCount += 1;
        customer.lifetimeSpending += totalDue;
        customer.lastVisit = new Date();
        if (isPartial) {
          const unpaidAmount = totalDue - paidAmount;
          customer.outstandingBalance += unpaidAmount;
        }
      } else {
        // finishGroup was already called, so visitCount/spending were recorded.
        // We only need to subtract the amount paid from the outstanding balance
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance - paidAmount);
      }
      await customer.save();
    }
  }

  return getGroupSessions(groupId, organizationId);
};

module.exports = {
  startSession,
  addSessionToGroup,
  pauseSession,
  resumeSession,
  getRunningCharges,
  endSession,
  getGroupSessions,
  finishGroup,
  checkoutGroup,
};
