const { Expense, ActivityLog } = require('../models');
const { AppResponse, parsePagination } = require('../utils');
const { notificationService } = require('../services');
const asyncHandler = require('../middleware/asyncHandler');

const getExpenses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { organizationId: req.orgId };

  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.payment_method) filter.paymentMethod = req.query.payment_method;
  if (req.query.is_recurring) filter.isRecurring = req.query.is_recurring === 'true';
  if (req.query.date_from) filter.date = { ...filter.date, $gte: new Date(req.query.date_from) };
  if (req.query.date_to) filter.date = { ...filter.date, $lte: new Date(req.query.date_to) };
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } },
      { vendor: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name'),
    Expense.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: expenses, pagination: { page, limit, total } });
});

const getExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id)
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name');
  if (!expense) {
    return AppResponse.error(res, { message: 'Expense not found', statusCode: 404 });
  }
  AppResponse.success(res, { data: { expense } });
});

const createExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.create({
    ...req.body,
    organizationId: req.orgId,
    createdBy: req.user._id,
  });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Expense recorded',
    module: 'expense',
    details: `Recorded expense: ${expense.title} - ${expense.category} - ${expense.amount}`,
    resourceId: expense._id,
    resourceModel: 'Expense',
    ipAddress: req.ip,
  });

  await notificationService.notifyExpenseCreated(expense, req.orgId, req.app.get('io'));

  AppResponse.created(res, { data: { expense } });
});

const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!expense) {
    return AppResponse.error(res, { message: 'Expense not found', statusCode: 404 });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'Expense updated',
    module: 'expense',
    details: `Updated expense: ${expense.title} - ${expense.category} - ${expense.amount}`,
    resourceId: expense._id,
    resourceModel: 'Expense',
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: { expense }, message: 'Expense updated' });
});

const approveExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    return AppResponse.error(res, { message: 'Expense not found', statusCode: 404 });
  }

  expense.status = 'approved';
  expense.approvedBy = req.user._id;
  expense.approvedAt = new Date();
  await expense.save();

  await ActivityLog.create({
    user: req.user._id,
    action: 'Expense approved',
    module: 'expense',
    details: `Approved expense: ${expense.title} - ${expense.category} - ${expense.amount}`,
    resourceId: expense._id,
    resourceModel: 'Expense',
    ipAddress: req.ip,
  });

  await notificationService.notifyExpenseApproved(expense, req.orgId, req.app.get('io'));

  AppResponse.success(res, { data: { expense }, message: 'Expense approved' });
});

const rejectExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    return AppResponse.error(res, { message: 'Expense not found', statusCode: 404 });
  }

  expense.status = 'rejected';
  expense.approvedBy = req.user._id;
  expense.approvedAt = new Date();
  await expense.save();

  await ActivityLog.create({
    user: req.user._id,
    action: 'Expense rejected',
    module: 'expense',
    details: `Rejected expense: ${expense.title} - ${expense.category} - ${expense.amount}`,
    resourceId: expense._id,
    resourceModel: 'Expense',
    ipAddress: req.ip,
  });

  await notificationService.notifyExpenseRejected(expense, req.orgId, req.app.get('io'));

  AppResponse.success(res, { data: { expense }, message: 'Expense rejected' });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    return AppResponse.error(res, { message: 'Expense not found', statusCode: 404 });
  }

  await expense.deleteOne();

  await ActivityLog.create({
    user: req.user._id,
    action: 'Expense deleted',
    module: 'expense',
    details: `Deleted expense: ${expense.title} - ${expense.category} - ${expense.amount}`,
    ipAddress: req.ip,
  });

  AppResponse.success(res, { message: 'Expense deleted' });
});

module.exports = {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  approveExpense,
  rejectExpense,
  deleteExpense,
};
