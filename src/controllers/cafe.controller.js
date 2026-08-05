const { CafeProduct, ActivityLog, Inventory, CafeOrder } = require('../models');
const { AppResponse, parsePagination, buildSort } = require('../utils');
const notificationService = require('../services/notification.service');
const asyncHandler = require('../middleware/asyncHandler');

const allowedFields = ['name', 'category', 'isAvailable'];

const getProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = buildSort(req.query.sort, allowedFields);
  const filter = { organizationId: req.orgId };

  if (req.query.category) filter.category = req.query.category;
  if (req.query.isAvailable !== undefined) filter.isAvailable = req.query.isAvailable === 'true';
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: 'i' };
  }

  const [products, total] = await Promise.all([
    CafeProduct.find(filter).sort(sort).skip(skip).limit(limit),
    CafeProduct.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: products, pagination: { page, limit, total } });
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await CafeProduct.distinct('category', { organizationId: req.orgId });
  AppResponse.success(res, { data: { categories } });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await CafeProduct.findById(req.params.id);
  if (!product) {
    return AppResponse.error(res, { message: 'Product not found', statusCode: 404 });
  }
  AppResponse.success(res, { data: { product } });
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await CafeProduct.create({ ...req.body, organizationId: req.orgId, createdBy: req.user._id });

  await Inventory.create({
    organizationId: req.orgId,
    product: product._id,
    quantity: product.stockQuantity,
    type: 'purchase',
    unitPrice: product.purchasePrice,
    totalCost: product.purchasePrice * product.stockQuantity,
    notes: 'Initial stock',
    createdBy: req.user._id,
  });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Cafe product created',
    module: 'cafe',
    details: `Created product: ${product.name}`,
    resourceId: product._id,
    resourceModel: 'CafeProduct',
    ipAddress: req.ip,
  });

  AppResponse.created(res, { data: { product } });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await CafeProduct.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return AppResponse.error(res, { message: 'Product not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: { product }, message: 'Product updated' });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await CafeProduct.findById(req.params.id);
  if (!product) {
    return AppResponse.error(res, { message: 'Product not found', statusCode: 404 });
  }

  product.isAvailable = false;
  await product.save();

  AppResponse.success(res, { message: 'Product deactivated' });
});

const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {
    organizationId: req.orgId,
  };

  if (req.query.saleMode) filter.saleMode = req.query.saleMode;
  if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.customerName) filter.customerName = { $regex: req.query.customerName, $options: 'i' };
  if (req.query.search) {
    filter.$or = [
      { receiptNumber: { $regex: req.query.search, $options: 'i' } },
      { customerName: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [orders, total] = await Promise.all([
    CafeOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name role')
      .populate('session', 'groupId status receiptNumber')
      .populate('items.product', 'name category sellingPrice'),
    CafeOrder.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: orders, pagination: { page, limit, total } });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await CafeOrder.findOne({
    _id: req.params.id,
    organizationId: req.orgId,
  })
    .populate('createdBy', 'name role')
    .populate('session', 'groupId status receiptNumber table customer')
    .populate('items.product', 'name category sellingPrice purchasePrice');

  if (!order) {
    return AppResponse.error(res, { message: 'Order not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: { order } });
});

const createWalkInOrder = asyncHandler(async (req, res) => {
  const { items, paymentMethod, customerName, discount = 0, notes = '' } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return AppResponse.error(res, { message: 'At least one item is required', statusCode: 400 });
  }

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await CafeProduct.findById(item.productId);
    if (!product) {
      return AppResponse.error(res, { message: `Product not found: ${item.productId}`, statusCode: 404 });
    }

    if (!product.isAvailable) {
      return AppResponse.error(res, { message: `Product unavailable: ${product.name}`, statusCode: 400 });
    }

    const quantity = Math.max(1, Number(item.quantity || 1));
    if (product.stockQuantity < quantity) {
      return AppResponse.error(res, {
        message: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`,
        statusCode: 400,
      });
    }

    const lineTotal = Math.round(product.sellingPrice * quantity);
    subtotal += lineTotal;

    orderItems.push({
      product: product._id,
      name: product.name,
      price: product.sellingPrice,
      quantity,
      subtotal: lineTotal,
    });

    product.stockQuantity -= quantity;
    await product.save();

    await Inventory.create({
      organizationId: req.orgId,
      product: product._id,
      quantity: -quantity,
      type: 'sale',
      unitPrice: product.sellingPrice,
      totalCost: lineTotal,
      notes: `Walk-in cafe sale${customerName ? ` for ${customerName}` : ''}`,
      createdBy: req.user._id,
    });

    if (product.stockQuantity <= product.minStockThreshold) {
      await notificationService.notifyLowInventory(product, req.orgId, req.app.get('io'));
    }

    if (product.stockQuantity <= 0) {
      await notificationService.notifyOutOfStock(product, req.orgId, req.app.get('io'));
    }
  }

  const discountAmount = Math.max(0, Number(discount) || 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const order = await CafeOrder.create({
    organizationId: req.orgId,
    saleMode: 'walk_in',
    session: null,
    customerName: customerName || '',
    paymentMethod,
    paymentStatus: 'paid',
    amountPaid: totalAmount,
    items: orderItems,
    totalAmount,
    discount: discountAmount,
    notes,
    createdBy: req.user._id,
  });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Walk-in cafe sale',
    module: 'cafe',
    details: `Walk-in cafe sale recorded for ${orderItems.length} item(s)`,
    resourceId: order._id,
    resourceModel: 'CafeOrder',
    ipAddress: req.ip,
  });

  await notificationService.notifyCafeWalkInOrder(order, req.orgId, req.app.get('io'));

  if (totalAmount >= 5000) {
    await notificationService.notifyCafeLargeOrder(order, req.orgId, req.app.get('io'));
  }

  AppResponse.created(res, { data: { order }, message: 'Walk-in sale completed' });
});

module.exports = {
  getProducts,
  getCategories,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  createWalkInOrder,
  getOrders,
  getOrder,
};
