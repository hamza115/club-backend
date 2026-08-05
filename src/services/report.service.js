const { Session, Payment, Expense, CafeProduct, Customer, CafeOrder, Inventory, Table } = require('../models');
const { PAYMENT_STATUS } = require('../config/constants');

const getDateRange = (type, customStart, customEnd) => {
  const now = new Date();
  let start, end;

  switch (type) {
    case 'daily': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      break;
    }
    case 'weekly': {
      const day = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    }
    case 'monthly': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    }
    case 'yearly': {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    }
    default: {
      start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = customEnd ? new Date(customEnd) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  return { start, end };
};

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// ─── Dashboard Summary ───────────────────────────────────────────────────
const generateDashboardStats = async (orgId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const dateFilter = { organizationId: orgId, createdAt: { $gte: today, $lt: tomorrow } };

  const [todaySessions, activeSessions, todayRevenue, totalCustomers, lowStockProducts] = await Promise.all([
    Session.countDocuments(dateFilter),
    Session.countDocuments({ organizationId: orgId, status: 'active' }),
    Session.aggregate([
      { $match: { organizationId: orgId, createdAt: { $gte: today, $lt: tomorrow }, paymentStatus: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]),
    Customer.countDocuments({ organizationId: orgId }),
    CafeProduct.countDocuments({ organizationId: orgId, $expr: { $lte: ['$stockQuantity', '$minStockThreshold'] } }),
  ]);

  const pendingPayments = await Session.aggregate([
    { $match: { organizationId: orgId, paymentStatus: PAYMENT_STATUS.PENDING } },
    { $group: { _id: null, total: { $sum: { $subtract: ['$finalAmount', '$amountPaid'] } }, count: { $sum: 1 } } },
  ]);

  const todayExpenses = await Expense.aggregate([
    { $match: { organizationId: orgId, status: 'approved', date: { $gte: today, $lt: tomorrow } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const recentSessions = await Session.find({ organizationId: orgId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('customer', 'name')
    .populate('table', 'tableNumber')
    .select('status finalAmount paymentStatus createdAt');

  const todayCafeRevenue = await CafeOrder.aggregate([
    { $match: { organizationId: orgId, createdAt: { $gte: today, $lt: tomorrow } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);

  const todaySessionCafeRevenue = await Session.aggregate([
    { $match: { ...dateFilter, cafeCharges: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$cafeCharges' } } },
  ]);

  // Weekly revenue trend (last 7 days)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const dailyRevenue = await Session.aggregate([
    {
      $match: {
        organizationId: orgId,
        createdAt: { $gte: sevenDaysAgo, $lt: tomorrow },
        paymentStatus: PAYMENT_STATUS.PAID,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$finalAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const dailyWalkIn = await CafeOrder.aggregate([
    {
      $match: {
        organizationId: orgId,
        createdAt: { $gte: sevenDaysAgo, $lt: tomorrow },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Build 7-day array with all days filled
  const revenueByDay = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    revenueByDay[key] = 0;
  }
  dailyRevenue.forEach((r) => {
    if (revenueByDay[r._id] !== undefined) revenueByDay[r._id] += r.revenue;
  });
  dailyWalkIn.forEach((r) => {
    if (revenueByDay[r._id] !== undefined) revenueByDay[r._id] += r.revenue;
  });

  const weeklyRevenueTrend = Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue }));

  const totalRevenue = todayRevenue[0]?.total || 0;
  const totalExpenses = todayExpenses[0]?.total || 0;
  const walkInCafe = todayCafeRevenue[0]?.total || 0;
  const sessionCafe = todaySessionCafeRevenue[0]?.total || 0;

  return {
    todayRevenue: totalRevenue,
    todayTableRevenue: totalRevenue - sessionCafe,
    todaySessionCafeRevenue: sessionCafe,
    todayWalkInCafeRevenue: walkInCafe,
    todayTotalCafeRevenue: sessionCafe + walkInCafe,
    todayExpenses: totalExpenses,
    todayNetProfit: totalRevenue + walkInCafe - totalExpenses,
    pendingPayments: {
      total: pendingPayments[0]?.total || 0,
      count: pendingPayments[0]?.count || 0,
    },
    todaySessions,
    activeSessions,
    totalCustomers,
    lowStockProducts,
    recentSessions,
    weeklyRevenueTrend,
  };
};

// ─── Revenue Report ──────────────────────────────────────────────────────
const generateRevenueReport = async (orgId, type, customStart, customEnd) => {
  const { start, end } = getDateRange(type, customStart, customEnd);

  const sessions = await Session.find({
    organizationId: orgId,
    createdAt: { $gte: start, $lt: end },
    status: 'completed',
  });

  const walkInOrders = await CafeOrder.find({
    organizationId: orgId,
    createdAt: { $gte: start, $lt: end },
  });

  const totalRevenue = sessions.reduce((sum, s) => sum + s.finalAmount, 0);
  const totalTableRevenue = sessions.reduce((sum, s) => sum + s.tableCharges, 0);
  const totalSessionCafeRevenue = sessions.reduce((sum, s) => sum + s.cafeCharges, 0);
  const totalWalkInCafeRevenue = walkInOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCafeRevenue = totalSessionCafeRevenue + totalWalkInCafeRevenue;
  const totalDiscounts = sessions.reduce((sum, s) => sum + s.discount, 0);
  const sessionCount = sessions.length;

  return {
    period: { start, end },
    type,
    totalRevenue: totalRevenue + totalWalkInCafeRevenue,
    totalTableRevenue,
    totalSessionCafeRevenue,
    totalWalkInCafeRevenue,
    totalCafeRevenue,
    totalDiscounts,
    sessionCount,
    walkInOrderCount: walkInOrders.length,
    averagePerSession: sessionCount ? Math.round(totalRevenue / sessionCount) : 0,
  };
};

// ─── Expense Report ──────────────────────────────────────────────────────
const generateExpenseReport = async (orgId, type, customStart, customEnd) => {
  const { start, end } = getDateRange(type, customStart, customEnd);

  const expenses = await Expense.find({
    organizationId: orgId,
    date: { $gte: start, $lt: end },
  });

  const approvedExpenses = expenses.filter((e) => e.status === 'approved');
  const totalExpenses = approvedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = expenses.filter((e) => e.status === 'pending').length;

  const byCategory = {};
  for (const expense of approvedExpenses) {
    byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
  }

  const byPaymentMethod = {};
  for (const expense of approvedExpenses) {
    byPaymentMethod[expense.paymentMethod] = (byPaymentMethod[expense.paymentMethod] || 0) + expense.amount;
  }

  const monthly = {};
  for (const expense of approvedExpenses) {
    const key = expense.date.toISOString().slice(0, 7);
    monthly[key] = (monthly[key] || 0) + expense.amount;
  }

  return {
    period: { start, end },
    type,
    totalExpenses,
    expenseCount: expenses.length,
    approvedCount: approvedExpenses.length,
    pendingCount,
    byCategory,
    byPaymentMethod,
    monthlyTrend: Object.entries(monthly).map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)),
  };
};

// ─── Profit Report ───────────────────────────────────────────────────────
const generateProfitReport = async (orgId, type, customStart, customEnd) => {
  const revenue = await generateRevenueReport(orgId, type, customStart, customEnd);
  const expense = await generateExpenseReport(orgId, type, customStart, customEnd);

  const totalRevenue = revenue.totalRevenue;
  const totalExpenses = expense.totalExpenses;

  return {
    period: revenue.period,
    type,
    grossRevenue: totalRevenue,
    totalTableRevenue: revenue.totalTableRevenue,
    totalCafeRevenue: revenue.totalCafeRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    profitMargin: totalRevenue
      ? Math.round(((totalRevenue - totalExpenses) / totalRevenue) * 100)
      : 0,
  };
};

// ─── Customer Report ─────────────────────────────────────────────────────
const generateCustomerReport = async (orgId) => {
  const totalCustomers = await Customer.countDocuments({ organizationId: orgId });
  const withOutstanding = await Customer.countDocuments({ organizationId: orgId, outstandingBalance: { $gt: 0 } });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newCustomers = await Customer.countDocuments({ organizationId: orgId, createdAt: { $gte: thirtyDaysAgo } });

  const returningCustomers = await Customer.countDocuments({ organizationId: orgId, visitCount: { $gt: 1 } });

  const topSpenders = await Customer.find({ organizationId: orgId })
    .sort({ lifetimeSpending: -1 })
    .limit(10)
    .select('name phone visitCount lifetimeSpending');

  const totalOutstanding = await Customer.aggregate([
    { $match: { organizationId: orgId } },
    { $group: { _id: null, total: { $sum: '$outstandingBalance' } } },
  ]);

  const avgSpending = await Customer.aggregate([
    { $match: { organizationId: orgId, lifetimeSpending: { $gt: 0 } } },
    { $group: { _id: null, avg: { $avg: '$lifetimeSpending' } } },
  ]);

  return {
    totalCustomers,
    newCustomers,
    returningCustomers,
    withOutstanding,
    totalOutstanding: totalOutstanding[0]?.total || 0,
    averageSpending: Math.round(avgSpending[0]?.avg || 0),
    topSpenders,
  };
};

// ─── Session Report ──────────────────────────────────────────────────────
const generateSessionReport = async (orgId, type, customStart, customEnd) => {
  const { start, end } = getDateRange(type, customStart, customEnd);

  const sessions = await Session.find({
    organizationId: orgId,
    createdAt: { $gte: start, $lt: end },
  }).populate('customer', 'name').populate('table', 'tableNumber');

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const totalRevenue = completedSessions.reduce((sum, s) => sum + s.finalAmount, 0);

  const durations = completedSessions
    .filter(s => s.startTime && s.endTime)
    .map(s => (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60));

  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const avgValue = completedSessions.length ? Math.round(totalRevenue / completedSessions.length) : 0;

  const highestBill = completedSessions.length ? Math.max(...completedSessions.map(s => s.finalAmount)) : 0;
  const lowestBill = completedSessions.length ? Math.min(...completedSessions.map(s => s.finalAmount)) : 0;

  const byStatus = {};
  for (const s of sessions) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
  }

  const byPricingMethod = {};
  for (const s of sessions) {
    byPricingMethod[s.pricingMethod] = (byPricingMethod[s.pricingMethod] || 0) + 1;
  }

  const recentSessions = completedSessions
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map(s => ({
      _id: s._id,
      receiptNumber: s.receiptNumber,
      customerName: s.customer?.name || 'Guest',
      tableNumber: s.table?.tableNumber || null,
      status: s.status,
      pricingMethod: s.pricingMethod,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.startTime && s.endTime ? Math.round((new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60)) : null,
      tableCharges: s.tableCharges,
      cafeCharges: s.cafeCharges,
      finalAmount: s.finalAmount,
      paymentStatus: s.paymentStatus,
      paymentMethod: s.paymentMethod,
    }));

  return {
    period: { start, end },
    type,
    totalSessions,
    completedSessions: completedSessions.length,
    totalRevenue,
    avgDuration,
    avgValue,
    highestBill,
    lowestBill,
    byStatus,
    byPricingMethod,
    sessions: recentSessions,
  };
};

// ─── Table Usage Report ──────────────────────────────────────────────────
const generateTableUsageReport = async (orgId, type, customStart, customEnd) => {
  const { start, end } = getDateRange(type, customStart, customEnd);

  const tables = await Table.find({ organizationId: orgId });
  const sessions = await Session.find({
    organizationId: orgId,
    createdAt: { $gte: start, $lt: end },
    status: 'completed',
  });

  const tableMap = {};
  for (const t of tables) {
    tableMap[t._id.toString()] = {
      tableId: t._id,
      tableNumber: t.tableNumber,
      sessionCount: 0,
      totalMinutes: 0,
      totalRevenue: 0,
      tableRevenue: 0,
      cafeRevenue: 0,
    };
  }

  for (const s of sessions) {
    const key = s.table?.toString();
    if (!key || !tableMap[key]) continue;
    tableMap[key].sessionCount += 1;
    tableMap[key].totalRevenue += s.finalAmount || 0;
    tableMap[key].tableRevenue += s.tableCharges || 0;
    tableMap[key].cafeRevenue += s.cafeCharges || 0;

    if (s.startTime && s.endTime) {
      tableMap[key].totalMinutes += Math.round((new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60));
    }
  }

  const totalHoursInPeriod = (end - start) / (1000 * 60 * 60);
  const tableData = Object.values(tableMap).map(t => ({
    ...t,
    avgDuration: t.sessionCount ? Math.round(t.totalMinutes / t.sessionCount) : 0,
    avgRevenue: t.sessionCount ? Math.round(t.totalRevenue / t.sessionCount) : 0,
    occupancyPercent: totalHoursInPeriod > 0
      ? Math.round((t.totalMinutes / (totalHoursInPeriod * 60)) * 100)
      : 0,
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    period: { start, end },
    type,
    totalTables: tables.length,
    tables: tableData,
  };
};

// ─── Cafe Sales Report ───────────────────────────────────────────────────
const generateCafeSalesReport = async (orgId, startDate, endDate) => {
  const start = startDate ? parseLocalDate(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = endDate ? parseLocalDate(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const baseFilter = {
    organizationId: orgId,
    createdAt: { $gte: start, $lte: end },
  };

  const walkInOrders = await CafeOrder.find({
    ...baseFilter,
    saleMode: 'walk_in',
  }).select('receiptNumber totalAmount customerName items createdAt').lean();

  const sessionCafeOrders = await Session.find({
    ...baseFilter,
    cafeItems: { $exists: true, $not: { $size: 0 } },
  }).select('cafeItems cafeCharges createdAt customer table')
    .populate('customer', 'name')
    .populate('table', 'tableNumber')
    .lean();

  const productMap = new Map();
  function aggregateItem(item) {
    const key = item.name || 'Unknown';
    if (!productMap.has(key)) {
      productMap.set(key, { name: key, category: item.category || 'General', totalQuantity: 0, totalRevenue: 0 });
    }
    const entry = productMap.get(key);
    entry.totalQuantity += item.quantity || 0;
    entry.totalRevenue += item.subtotal || 0;
  }

  const dailyMap = new Map();
  function getDay(dateStr) {
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { date: dateStr, walkInRevenue: 0, sessionCafeRevenue: 0, totalRevenue: 0, orderCount: 0 });
    }
    return dailyMap.get(dateStr);
  }

  for (const order of walkInOrders) {
    const dateStr = order.createdAt.toISOString().slice(0, 10);
    const day = getDay(dateStr);
    day.walkInRevenue += order.totalAmount || 0;
    day.totalRevenue += order.totalAmount || 0;
    day.orderCount += 1;
    for (const item of order.items) aggregateItem(item);
  }

  for (const session of sessionCafeOrders) {
    const dateStr = session.createdAt.toISOString().slice(0, 10);
    const day = getDay(dateStr);
    day.sessionCafeRevenue += session.cafeCharges || 0;
    day.totalRevenue += session.cafeCharges || 0;
    day.orderCount += 1;
    for (const item of session.cafeItems) aggregateItem(item);
  }

  let totalWalkInRevenue = 0;
  let totalSessionCafeRevenue = 0;
  let totalItemsSold = 0;

  for (const [, entry] of productMap) totalItemsSold += entry.totalQuantity;
  for (const order of walkInOrders) totalWalkInRevenue += order.totalAmount || 0;
  for (const session of sessionCafeOrders) totalSessionCafeRevenue += session.cafeCharges || 0;

  const totalOrders = walkInOrders.length + sessionCafeOrders.length;
  const sortedDates = [...dailyMap.keys()].sort();
  const dailyBreakdown = sortedDates.map(d => dailyMap.get(d));

  const allProducts = [...productMap.values()].sort((a, b) => b.totalRevenue - a.totalRevenue);

  const categoryMap = {};
  for (const p of allProducts) {
    categoryMap[p.category] = (categoryMap[p.category] || 0) + p.totalRevenue;
  }

  return {
    summary: {
      totalWalkInRevenue,
      totalSessionCafeRevenue,
      totalCafeRevenue: totalWalkInRevenue + totalSessionCafeRevenue,
      totalOrders,
      totalItemsSold,
      avgOrderValue: totalOrders ? Math.round((totalWalkInRevenue + totalSessionCafeRevenue) / totalOrders) : 0,
    },
    products: allProducts,
    categoryBreakdown: Object.entries(categoryMap).map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue),
    dailyBreakdown,
    period: { start, end },
  };
};

// ─── Product Sales Report ────────────────────────────────────────────────
const generateProductSalesReport = async (orgId, type, customStart, customEnd) => {
  const { start, end } = getDateRange(type, customStart, customEnd);

  const products = await CafeProduct.find({ organizationId: orgId }).lean();

  const sessionItems = await Session.aggregate([
    { $match: { organizationId: orgId, createdAt: { $gte: start, $lt: end }, status: 'completed' } },
    { $unwind: '$cafeItems' },
    { $group: {
      _id: '$cafeItems.product',
      qtySold: { $sum: '$cafeItems.quantity' },
      revenue: { $sum: '$cafeItems.subtotal' },
    }},
  ]);

  const walkInItems = await CafeOrder.aggregate([
    { $match: { organizationId: orgId, createdAt: { $gte: start, $lt: end } } },
    { $unwind: '$items' },
    { $group: {
      _id: '$items.product',
      qtySold: { $sum: '$items.quantity' },
      revenue: { $sum: '$items.subtotal' },
    }},
  ]);

  const salesMap = new Map();
  for (const item of [...sessionItems, ...walkInItems]) {
    const key = item._id?.toString();
    if (!key) continue;
    const existing = salesMap.get(key) || { qtySold: 0, revenue: 0 };
    salesMap.set(key, {
      qtySold: existing.qtySold + item.qtySold,
      revenue: existing.revenue + item.revenue,
    });
  }

  const productData = products.map(p => {
    const sales = salesMap.get(p._id.toString()) || { qtySold: 0, revenue: 0 };
    const purchaseCost = p.purchasePrice * sales.qtySold;
    return {
      _id: p._id,
      name: p.name,
      category: p.category,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      qtySold: sales.qtySold,
      revenue: sales.revenue,
      purchaseCost,
      profit: sales.revenue - purchaseCost,
      remainingStock: p.stockQuantity,
      isAvailable: p.isAvailable,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = productData.reduce((sum, p) => sum + p.revenue, 0);
  const totalCost = productData.reduce((sum, p) => sum + p.purchaseCost, 0);
  const totalQtySold = productData.reduce((sum, p) => sum + p.qtySold, 0);

  return {
    period: { start, end },
    type,
    totalRevenue,
    totalCost,
    totalProfit: totalRevenue - totalCost,
    totalQtySold,
    products: productData,
  };
};

// ─── Inventory Report ────────────────────────────────────────────────────
const generateInventoryReport = async (orgId) => {
  const products = await CafeProduct.find({ organizationId: orgId }).lean();

  const lowStock = products.filter(p => p.stockQuantity <= p.minStockThreshold);
  const outOfStock = products.filter(p => p.stockQuantity === 0);

  const totalInventoryValue = products.reduce((sum, p) => sum + (p.purchasePrice * p.stockQuantity), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.stockQuantity), 0);

  const recentMovements = await Inventory.find({ organizationId: orgId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('product', 'name category')
    .populate('createdBy', 'name')
    .lean();

  const purchases = await Inventory.aggregate([
    { $match: { organizationId: orgId, type: 'purchase' } },
    { $group: { _id: null, totalQty: { $sum: '$quantity' }, totalCost: { $sum: '$totalCost' } } },
  ]);

  const sold = await Inventory.aggregate([
    { $match: { organizationId: orgId, type: 'sale' } },
    { $group: { _id: null, totalQty: { $sum: { $abs: '$quantity' } }, totalRevenue: { $sum: '$totalCost' } } },
  ]);

  const byCategory = {};
  for (const p of products) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }

  return {
    totalProducts: products.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    totalInventoryValue,
    totalRetailValue,
    potentialProfit: totalRetailValue - totalInventoryValue,
    purchases: { totalQty: purchases[0]?.totalQty || 0, totalCost: purchases[0]?.totalCost || 0 },
    sold: { totalQty: sold[0]?.totalQty || 0, totalRevenue: sold[0]?.totalRevenue || 0 },
    byCategory,
    lowStockProducts: lowStock.map(p => ({ _id: p._id, name: p.name, category: p.category, stockQuantity: p.stockQuantity, minStockThreshold: p.minStockThreshold })),
    outOfStockProducts: outOfStock.map(p => ({ _id: p._id, name: p.name, category: p.category })),
    recentMovements,
  };
};

// ─── Payment Report ──────────────────────────────────────────────────────
const generatePaymentReport = async (orgId, type, customStart, customEnd) => {
  const { start, end } = getDateRange(type, customStart, customEnd);

  const payments = await Payment.find({
    organizationId: orgId,
    createdAt: { $gte: start, $lt: end },
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const byMethod = {};
  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  }

  const byStatus = {};
  for (const p of payments) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  }

  const byMethodCount = {};
  for (const p of payments) {
    byMethodCount[p.method] = (byMethodCount[p.method] || 0) + 1;
  }

  const sessionPayments = await Session.aggregate([
    { $match: { organizationId: orgId, createdAt: { $gte: start, $lt: end } } },
    { $group: {
      _id: '$paymentStatus',
      total: { $sum: '$finalAmount' },
      paid: { $sum: '$amountPaid' },
      count: { $sum: 1 },
    }},
  ]);

  return {
    period: { start, end },
    type,
    totalPayments: payments.length,
    totalAmount,
    byMethod,
    byMethodCount,
    byStatus,
    sessionPayments: sessionPayments.map(s => ({
      status: s._id,
      total: s.total,
      paid: s.paid,
      outstanding: s.total - s.paid,
      count: s.count,
    })),
  };
};

// ─── Daily Closing Report ────────────────────────────────────────────────
const generateDailyClosingReport = async (orgId, date) => {
  const targetDate = date ? parseLocalDate(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

  const dayFilter = { organizationId: orgId, createdAt: { $gte: targetDate, $lt: nextDay } };

  const [sessions, walkInOrders, expenses, payments] = await Promise.all([
    Session.find({ ...dayFilter, status: 'completed' }).populate('customer', 'name').populate('table', 'tableNumber').lean(),
    CafeOrder.find({ ...dayFilter, saleMode: 'walk_in' }).lean(),
    Expense.find({ organizationId: orgId, status: 'approved', date: { $gte: targetDate, $lt: nextDay } }).lean(),
    Payment.find({ organizationId: orgId, createdAt: { $gte: targetDate, $lt: nextDay } }).lean(),
  ]);

  const totalTableRevenue = sessions.reduce((sum, s) => sum + s.tableCharges, 0);
  const totalSessionCafeRevenue = sessions.reduce((sum, s) => sum + s.cafeCharges, 0);
  const totalWalkInCafeRevenue = walkInOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCafeRevenue = totalSessionCafeRevenue + totalWalkInCafeRevenue;
  const totalRevenue = totalTableRevenue + totalCafeRevenue;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalDiscounts = sessions.reduce((sum, s) => sum + s.discount, 0);
  const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  const byPaymentMethod = {};
  for (const p of payments) {
    byPaymentMethod[p.method] = (byPaymentMethod[p.method] || 0) + p.amount;
  }

  const expenseByCategory = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
  }

  const pendingPayments = sessions.filter(s => s.paymentStatus !== 'paid');

  return {
    date: targetDate,
    summary: {
      totalTableRevenue,
      totalSessionCafeRevenue,
      totalWalkInCafeRevenue,
      totalCafeRevenue,
      totalRevenue,
      totalExpenses,
      totalDiscounts,
      netProfit: totalRevenue - totalExpenses,
      totalPaymentsReceived,
      changeDue: totalPaymentsReceived - totalRevenue,
    },
    sessionStats: {
      total: sessions.length,
      completed: sessions.filter(s => s.status === 'completed').length,
      avgValue: sessions.length ? Math.round(totalRevenue / sessions.length) : 0,
    },
    walkInOrders: {
      count: walkInOrders.length,
      revenue: totalWalkInCafeRevenue,
    },
    byPaymentMethod,
    expenseByCategory,
    pendingPayments: pendingPayments.map(s => ({
      _id: s._id,
      receiptNumber: s.receiptNumber,
      customerName: s.customer?.name || 'Guest',
      finalAmount: s.finalAmount,
      amountPaid: s.amountPaid,
      outstanding: s.finalAmount - s.amountPaid,
    })),
  };
};

// ─── Business Insights ───────────────────────────────────────────────────
const generateBusinessInsights = async (orgId) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const last30 = { organizationId: orgId, createdAt: { $gte: thirtyDaysAgo, $lt: now } };
  const prev30 = { organizationId: orgId, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } };

  const [revenue30, revenuePrev30] = await Promise.all([
    Session.aggregate([
      { $match: { ...last30, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]),
    Session.aggregate([
      { $match: { ...prev30, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } },
    ]),
  ]);

  const currentRevenue = revenue30[0]?.total || 0;
  const previousRevenue = revenuePrev30[0]?.total || 0;
  const revenueGrowth = previousRevenue ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0;

  const hourlyData = await Session.aggregate([
    { $match: { organizationId: orgId, createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $hour: '$startTime' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const peakHours = hourlyData.slice(0, 5).map(h => ({
    hour: h._id,
    sessions: h.count,
    label: `${h._id}:00 - ${h._id + 1}:00`,
  }));

  const tableData = await Session.aggregate([
    { $match: { ...last30, status: 'completed' } },
    { $group: { _id: '$table', sessions: { $sum: 1 }, revenue: { $sum: '$finalAmount' } } },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);

  const tableIds = tableData.map(t => t._id);
  const tableInfo = await Table.find({ _id: { $in: tableIds } }).select('tableNumber');
  const tableLookup = {};
  for (const t of tableInfo) tableLookup[t._id.toString()] = t.tableNumber;

  const bestTables = tableData.map(t => ({
    tableId: t._id,
    tableNumber: tableLookup[t._id?.toString()] || null,
    sessions: t.sessions,
    revenue: t.revenue,
  }));

  const topProducts = await CafeOrder.aggregate([
    { $match: { ...last30 } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);

  const topSessionProducts = await Session.aggregate([
    { $match: { ...last30, status: 'completed' } },
    { $unwind: '$cafeItems' },
    { $group: { _id: '$cafeItems.name', qty: { $sum: '$cafeItems.quantity' }, revenue: { $sum: '$cafeItems.subtotal' } } },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);

  const combinedProducts = new Map();
  for (const p of [...topProducts, ...topSessionProducts]) {
    const existing = combinedProducts.get(p._id) || { qty: 0, revenue: 0 };
    combinedProducts.set(p._id, { name: p._id, qty: existing.qty + p.qty, revenue: existing.revenue + p.revenue });
  }
  const topProductsList = [...combinedProducts.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const topCustomers = await Customer.find({ organizationId: orgId })
    .sort({ lifetimeSpending: -1 })
    .limit(5)
    .select('name phone visitCount lifetimeSpending');

  return {
    revenueGrowth,
    currentPeriodRevenue: currentRevenue,
    previousPeriodRevenue: previousRevenue,
    peakHours,
    bestTables,
    topProducts: topProductsList,
    topCustomers,
  };
};

module.exports = {
  generateDashboardStats,
  generateRevenueReport,
  generateExpenseReport,
  generateProfitReport,
  generateCustomerReport,
  generateSessionReport,
  generateTableUsageReport,
  generateCafeSalesReport,
  generateProductSalesReport,
  generateInventoryReport,
  generatePaymentReport,
  generateDailyClosingReport,
  generateBusinessInsights,
};
