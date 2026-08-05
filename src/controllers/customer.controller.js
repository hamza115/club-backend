const { Customer, Session, ActivityLog } = require('../models');
const { AppResponse, parsePagination, buildSort, buildFilter } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');

const allowedFields = ['name', 'phone', 'email', 'search'];

const searchCustomers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 1) {
    return AppResponse.success(res, { data: [] });
  }

  const filter = { organizationId: req.orgId };
  filter.$or = [
    { name: { $regex: q.trim(), $options: 'i' } },
    { phone: { $regex: q.trim(), $options: 'i' } },
  ];

  const customers = await Customer.find(filter)
    .select('name phone visitCount')
    .limit(10)
    .lean();

  AppResponse.success(res, { data: customers });
});

const getCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = buildSort(req.query.sort, allowedFields);
  const filter = { organizationId: req.orgId, ...buildFilter(req.query, allowedFields) };

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { phone: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: customers, pagination: { page, limit, total } });
});

const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!customer) {
    return AppResponse.error(res, { message: 'Customer not found', statusCode: 404 });
  }

  // Fetch enough raw sessions to build up to 10 visits
  const recentRawSessions = await Session.find({ customer: customer._id, organizationId: req.orgId })
    .sort({ createdAt: -1 })
    .limit(40)
    .populate('table', 'tableNumber')
    .select('status finalAmount amountPaid paymentStatus createdAt startTime groupId table pricingMethod');

  // Group by visit (groupId or standalone session)
  const visitsMap = new Map();
  for (const s of recentRawSessions) {
    const key = s.groupId ? String(s.groupId) : String(s._id);
    if (!visitsMap.has(key)) {
      visitsMap.set(key, { groupId: s.groupId || null, sessions: [], table: s.table, startTime: s.startTime });
    }
    visitsMap.get(key).sessions.push(s);
  }

  const recentVisits = Array.from(visitsMap.values())
    .slice(0, 10)
    .map((visit) => {
      const sessions = visit.sessions;
      const totalAmount = sessions.reduce((sum, s) => sum + (s.finalAmount || 0), 0);
      const totalPaid = sessions.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
      const leftover = Math.max(0, totalAmount - totalPaid);

      const hasActive = sessions.some((s) => s.status === 'active' || s.status === 'paused');
      const allPaid = sessions.every((s) => s.paymentStatus === 'paid');
      let visitPaymentStatus = 'pending';
      if (hasActive) visitPaymentStatus = 'active';
      else if (allPaid) visitPaymentStatus = 'paid';
      else if (!allPaid && totalPaid > 0) visitPaymentStatus = 'partial';

      return {
        groupId: visit.groupId,
        table: visit.table,
        startTime: visit.startTime,
        sessionCount: sessions.length,
        totalAmount,
        totalPaid,
        leftover,
        paymentStatus: visitPaymentStatus,
      };
    });

  AppResponse.success(res, { data: { customer, recentVisits } });
});


const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create({ ...req.body, organizationId: req.orgId, createdBy: req.user._id });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Customer created',
    module: 'customer',
    details: `Created customer: ${customer.name}`,
    resourceId: customer._id,
    resourceModel: 'Customer',
    ipAddress: req.ip,
  });

  AppResponse.created(res, { data: { customer } });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.orgId },
    req.body,
    { new: true, runValidators: true },
  );
  if (!customer) {
    return AppResponse.error(res, { message: 'Customer not found', statusCode: 404 });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'Customer updated',
    module: 'customer',
    details: `Updated customer: ${customer.name}`,
    resourceId: customer._id,
    resourceModel: 'Customer',
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: { customer }, message: 'Customer updated' });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!customer) {
    return AppResponse.error(res, { message: 'Customer not found', statusCode: 404 });
  }

  const activeSession = await Session.findOne({ customer: customer._id, status: { $in: ['active', 'paused'] } });
  if (activeSession) {
    return AppResponse.error(res, { message: 'Cannot delete customer with an active session', statusCode: 400 });
  }

  await customer.deleteOne();

  await ActivityLog.create({
    user: req.user._id,
    action: 'Customer deleted',
    module: 'customer',
    details: `Deleted customer: ${customer.name}`,
    ipAddress: req.ip,
  });

  AppResponse.success(res, { message: 'Customer deleted' });
});

const getCustomerHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const [sessions, total] = await Promise.all([
    Session.find({ customer: req.params.id, organizationId: req.orgId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('table', 'tableNumber')
      .select('startTime endTime tableCharges cafeCharges finalAmount paymentStatus'),
    Session.countDocuments({ customer: req.params.id, organizationId: req.orgId }),
  ]);

  AppResponse.paginated(res, { data: sessions, pagination: { page, limit, total } });
});

const getOutstandingSessions = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!customer) {
    return AppResponse.error(res, { message: 'Customer not found', statusCode: 404 });
  }

  const sessions = await Session.find({
    customer: req.params.id,
    organizationId: req.orgId,
    paymentStatus: { $in: ['pending', 'partial'] },
  })
    .sort({ createdAt: -1 })
    .populate('table', 'tableNumber')
    .select('startTime endTime tableCharges cafeCharges finalAmount amountPaid paymentStatus receiptNumber');

  const totalOutstanding = sessions.reduce(
    (sum, s) => sum + (s.finalAmount - (s.amountPaid || 0)), 0,
  );

  AppResponse.success(res, {
    data: {
      customer: { name: customer.name, outstandingBalance: customer.outstandingBalance, creditLimit: customer.creditLimit },
      sessions,
      totalOutstanding,
    },
  });
});

const collectPayment = asyncHandler(async (req, res) => {
  const { amount, method, reference, notes } = req.body;

  if (!amount || amount <= 0) {
    return AppResponse.error(res, { message: 'Amount must be greater than 0', statusCode: 400 });
  }

  const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!customer) {
    return AppResponse.error(res, { message: 'Customer not found', statusCode: 404 });
  }

  if (amount > customer.outstandingBalance) {
    return AppResponse.error(res, { message: `Amount exceeds outstanding balance of ${customer.outstandingBalance}`, statusCode: 400 });
  }

  // Find the oldest pending/partial session and allocate payment
  const pendingSessions = await Session.find({
    customer: req.params.id,
    organizationId: req.orgId,
    paymentStatus: { $in: ['pending', 'partial'] },
  }).sort({ createdAt: 1 });

  let remaining = amount;
  for (const session of pendingSessions) {
    if (remaining <= 0) break;
    const sessionDue = session.finalAmount - (session.amountPaid || 0);
    const allocation = Math.min(remaining, sessionDue);

    session.amountPaid = (session.amountPaid || 0) + allocation;
    session.paymentMethod = method || session.paymentMethod;

    if (session.amountPaid >= session.finalAmount) {
      session.paymentStatus = 'paid';
    } else {
      session.paymentStatus = 'partial';
    }
    await session.save();
    remaining -= allocation;
  }

  // Update customer outstanding balance
  customer.outstandingBalance = Math.max(0, customer.outstandingBalance - amount);
  await customer.save();

  // Create a payment record
  const { Payment } = require('../models');
  if (pendingSessions.length > 0) {
    await Payment.create({
      organizationId: req.orgId,
      session: pendingSessions[0]._id,
      customer: customer._id,
      amount,
      method: method || 'cash',
      status: 'paid',
      reference,
      notes: notes || 'Outstanding balance collection',
      receivedBy: req.user._id,
    });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'Outstanding payment collected',
    module: 'payment',
    details: `Collected ${amount} from ${customer.name} against outstanding balance`,
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: { customer, amountCollected: amount }, message: 'Payment collected' });
});

const updateWallet = asyncHandler(async (req, res) => {
  const { amount, type, notes } = req.body;

  if (!amount || amount <= 0) {
    return AppResponse.error(res, { message: 'Amount must be greater than 0', statusCode: 400 });
  }

  if (!['credit', 'debit'].includes(type)) {
    return AppResponse.error(res, { message: 'Type must be "credit" or "debit"', statusCode: 400 });
  }

  const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.orgId });
  if (!customer) {
    return AppResponse.error(res, { message: 'Customer not found', statusCode: 404 });
  }

  if (type === 'debit' && amount > customer.walletBalance) {
    return AppResponse.error(res, { message: `Insufficient wallet balance. Current: ${customer.walletBalance}`, statusCode: 400 });
  }

  if (type === 'credit') {
    customer.walletBalance += amount;
  } else {
    customer.walletBalance -= amount;
  }
  await customer.save();

  await ActivityLog.create({
    user: req.user._id,
    action: type === 'credit' ? 'Wallet credited' : 'Wallet debited',
    module: 'customer',
    details: `${type === 'credit' ? 'Added' : 'Deducted'} ${amount} ${type === 'credit' ? 'to' : 'from'} ${customer.name}'s wallet. Balance: ${customer.walletBalance}`,
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: { walletBalance: customer.walletBalance }, message: `Wallet ${type === 'credit' ? 'credited' : 'debited'}` });
});

module.exports = { searchCustomers, getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerHistory, getOutstandingSessions, collectPayment, updateWallet };