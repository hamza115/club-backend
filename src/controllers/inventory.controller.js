const { Inventory, CafeProduct, ActivityLog } = require('../models');
const { AppResponse, parsePagination } = require('../utils');
const { notificationService } = require('../services');
const asyncHandler = require('../middleware/asyncHandler');

const getStock = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { organizationId: req.orgId };

  if (req.query.lowStock === 'true') {
    const products = await CafeProduct.find({
      $expr: { $lte: ['$stockQuantity', '$minStockThreshold'] },
    }).select('_id');
    filter.product = { $in: products.map((p) => p._id) };
  }

  const [records, total] = await Promise.all([
    Inventory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('product', 'name stockQuantity minStockThreshold category')
      .populate('createdBy', 'name'),
    Inventory.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: records, pagination: { page, limit, total } });
});

const addStock = asyncHandler(async (req, res) => {
  const { productId, quantity, unitPrice, supplier, notes } = req.body;

  const product = await CafeProduct.findById(productId);
  if (!product) {
    return AppResponse.error(res, { message: 'Product not found', statusCode: 404 });
  }

  const totalCost = unitPrice * quantity;

  const record = await Inventory.create({
    organizationId: req.orgId,
    product: productId,
    supplier,
    quantity,
    type: 'purchase',
    unitPrice,
    totalCost,
    notes: notes || `Stock purchase from ${supplier || 'unknown'}`,
    createdBy: req.user._id,
  });

  product.stockQuantity += quantity;
  await product.save();

  await ActivityLog.create({
    user: req.user._id,
    action: 'Stock added',
    module: 'inventory',
    details: `Added ${quantity} units of ${product.name}`,
    resourceId: record._id,
    resourceModel: 'Inventory',
    ipAddress: req.ip,
  });

  await notificationService.notifyStockPurchase(product, quantity, req.orgId, req.app.get('io'));

  AppResponse.created(res, { data: { record, currentStock: product.stockQuantity }, message: 'Stock added' });
});

const adjustStock = asyncHandler(async (req, res) => {
  const { productId, quantity, notes } = req.body;

  const product = await CafeProduct.findById(productId);
  if (!product) {
    return AppResponse.error(res, { message: 'Product not found', statusCode: 404 });
  }

  const newStock = product.stockQuantity + quantity;
  if (newStock < 0) {
    return AppResponse.error(res, { message: 'Adjustment would result in negative stock', statusCode: 400 });
  }

  const record = await Inventory.create({
    organizationId: req.orgId,
    product: productId,
    quantity,
    type: 'adjustment',
    unitPrice: product.purchasePrice,
    totalCost: 0,
    notes: notes || 'Manual stock adjustment',
    createdBy: req.user._id,
  });

  product.stockQuantity = newStock;
  await product.save();

  await ActivityLog.create({
    user: req.user._id,
    action: 'Stock adjusted',
    module: 'inventory',
    details: `Adjusted ${product.name} stock by ${quantity}. New stock: ${newStock}`,
    resourceId: record._id,
    resourceModel: 'Inventory',
    ipAddress: req.ip,
  });

  await notificationService.notifyStockAdjustment(product, quantity, req.orgId, req.app.get('io'));

  if (product.stockQuantity <= 0) {
    await notificationService.notifyOutOfStock(product, req.orgId, req.app.get('io'));
  } else if (product.stockQuantity <= product.minStockThreshold) {
    await notificationService.notifyLowInventory(product, req.orgId, req.app.get('io'));
  }

  AppResponse.success(res, { data: { record, currentStock: newStock }, message: 'Stock adjusted' });
});

const getStockHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const [records, total] = await Promise.all([
    Inventory.find({ product: req.params.productId, organizationId: req.orgId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name'),
    Inventory.countDocuments({ product: req.params.productId, organizationId: req.orgId }),
  ]);

  AppResponse.paginated(res, { data: records, pagination: { page, limit, total } });
});

module.exports = { getStock, addStock, adjustStock, getStockHistory };