const { Session, Payment, ActivityLog, Customer } = require('../models');
const { PAYMENT_STATUS } = require('../config/constants');
const { AppResponse, parsePagination } = require('../utils');
const { notificationService } = require('../services');
const asyncHandler = require('../middleware/asyncHandler');

const getPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { organizationId: req.orgId };

  if (req.query.method) filter.method = req.query.method;
  if (req.query.status) filter.status = req.query.status;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name')
      .populate('session', 'receiptNumber finalAmount')
      .populate('receivedBy', 'name'),
    Payment.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: payments, pagination: { page, limit, total } });
});

const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('customer', 'name phone')
    .populate('session', 'receiptNumber finalAmount tableCharges cafeCharges')
    .populate('receivedBy', 'name');

  if (!payment) {
    return AppResponse.error(res, { message: 'Payment not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: { payment } });
});

const recordPayment = asyncHandler(async (req, res) => {
  const { sessionId, amount, method, reference, notes } = req.body;

  const session = await Session.findById(sessionId);
  if (!session) {
    return AppResponse.error(res, { message: 'Session not found', statusCode: 404 });
  }

  const payment = await Payment.create({
    organizationId: req.orgId,
    session: sessionId,
    customer: session.customer,
    amount,
    method,
    status: PAYMENT_STATUS.PAID,
    reference,
    notes,
    receivedBy: req.user._id,
  });

  session.amountPaid = (session.amountPaid || 0) + amount;
  session.paymentMethod = method;

  if (session.amountPaid >= session.finalAmount) {
    session.paymentStatus = PAYMENT_STATUS.PAID;
  } else if (session.amountPaid > 0) {
    session.paymentStatus = PAYMENT_STATUS.PARTIAL;
  }

  await session.save();

  const customer = await Customer.findById(session.customer);
  if (customer) {
    const previousOutstanding = session.finalAmount - (session.amountPaid - amount);
    const newOutstanding = session.finalAmount - session.amountPaid;
    const delta = newOutstanding - previousOutstanding;
    customer.outstandingBalance = Math.max(0, customer.outstandingBalance + delta);
    await customer.save();
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'Payment recorded',
    module: 'payment',
    details: `Payment of ${amount} via ${method} for session ${session.receiptNumber || session._id}`,
    resourceId: payment._id,
    resourceModel: 'Payment',
    ipAddress: req.ip,
  });

  await notificationService.notifyPaymentReceived(payment, req.orgId, req.app.get('io'));

  if (session.paymentStatus === PAYMENT_STATUS.PARTIAL) {
    await notificationService.notifyPaymentPartial(session, req.orgId, req.app.get('io'));
  }

  AppResponse.created(res, { data: { payment, paymentStatus: session.paymentStatus }, message: 'Payment recorded' });
});

module.exports = { getPayments, getPayment, recordPayment };