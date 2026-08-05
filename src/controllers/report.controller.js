const { reportService } = require('../services');
const { notificationService } = require('../services');
const { AppResponse } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await reportService.generateDashboardStats(req.orgId);
  AppResponse.success(res, { data: stats });
});

const getRevenueReport = asyncHandler(async (req, res) => {
  const { type, start, end } = req.query;
  const report = await reportService.generateRevenueReport(req.orgId, type, start, end);
  AppResponse.success(res, { data: report });
});

const getExpenseReport = asyncHandler(async (req, res) => {
  const { type, start, end } = req.query;
  const report = await reportService.generateExpenseReport(req.orgId, type, start, end);
  AppResponse.success(res, { data: report });
});

const getProfitReport = asyncHandler(async (req, res) => {
  const { type, start, end } = req.query;
  const report = await reportService.generateProfitReport(req.orgId, type, start, end);
  AppResponse.success(res, { data: report });
});

const getCustomerReport = asyncHandler(async (req, res) => {
  const report = await reportService.generateCustomerReport(req.orgId);
  AppResponse.success(res, { data: report });
});

const getSessionReport = asyncHandler(async (req, res) => {
  const { type, start, end } = req.query;
  const report = await reportService.generateSessionReport(req.orgId, type, start, end);
  AppResponse.success(res, { data: report });
});

const getTableUsageReport = asyncHandler(async (req, res) => {
  const { type, start, end } = req.query;
  const report = await reportService.generateTableUsageReport(req.orgId, type, start, end);
  AppResponse.success(res, { data: report });
});

const getCafeSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return AppResponse.error(res, { message: 'startDate and endDate are required', statusCode: 400 });
  }
  const report = await reportService.generateCafeSalesReport(req.orgId, startDate, endDate);
  AppResponse.success(res, { data: report });
});

const getProductSalesReport = asyncHandler(async (req, res) => {
  const { type, start, end } = req.query;
  const report = await reportService.generateProductSalesReport(req.orgId, type, start, end);
  AppResponse.success(res, { data: report });
});

const getInventoryReport = asyncHandler(async (req, res) => {
  const report = await reportService.generateInventoryReport(req.orgId);
  AppResponse.success(res, { data: report });
});

const getPaymentReport = asyncHandler(async (req, res) => {
  const { type, start, end } = req.query;
  const report = await reportService.generatePaymentReport(req.orgId, type, start, end);
  AppResponse.success(res, { data: report });
});

const getDailyClosingReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const report = await reportService.generateDailyClosingReport(req.orgId, date);

  await notificationService.notifyDailyClosing(report, req.orgId, req.app.get('io'));

  AppResponse.success(res, { data: report });
});

const getBusinessInsights = asyncHandler(async (req, res) => {
  const insights = await reportService.generateBusinessInsights(req.orgId);
  AppResponse.success(res, { data: insights });
});

module.exports = {
  getDashboard,
  getRevenueReport,
  getExpenseReport,
  getProfitReport,
  getCustomerReport,
  getSessionReport,
  getTableUsageReport,
  getCafeSalesReport,
  getProductSalesReport,
  getInventoryReport,
  getPaymentReport,
  getDailyClosingReport,
  getBusinessInsights,
};
