const { CafeProduct, Inventory } = require('../models');

const addCafeItemsToSession = async (session, items, userId) => {
  if (!items || !items.length) {
    throw Object.assign(new Error('No items provided'), { statusCode: 400 });
  }

  const cafeItems = [];

  for (const item of items) {
    const product = await CafeProduct.findById(item.productId);
    if (!product) {
      throw Object.assign(new Error(`Product not found: ${item.productId}`), { statusCode: 404 });
    }

    if (!product.isAvailable) {
      throw Object.assign(new Error(`Product unavailable: ${product.name}`), { statusCode: 400 });
    }

    const quantity = item.quantity || 1;
    if (product.stockQuantity < quantity) {
      throw Object.assign(
        new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`),
        { statusCode: 400 },
      );
    }

    const subtotal = Math.round(product.sellingPrice * quantity);
    cafeItems.push({
      product: product._id,
      name: product.name,
      price: product.sellingPrice,
      quantity,
      subtotal,
    });

    product.stockQuantity -= quantity;
    await product.save();

    await Inventory.create({
      organizationId: session.organizationId,
      product: product._id,
      quantity: -quantity,
      type: 'sale',
      unitPrice: product.sellingPrice,
      totalCost: subtotal,
      notes: `Sold to session customer`,
      createdBy: userId,
    });
  }

  session.cafeItems.push(...cafeItems);
  await session.save();

  return session;
};

const removeCafeItem = async (session, itemId, userId) => {
  const itemIndex = session.cafeItems.findIndex((i) => i._id.toString() === itemId);
  if (itemIndex === -1) {
    throw Object.assign(new Error('Item not found in session'), { statusCode: 404 });
  }

  const item = session.cafeItems[itemIndex];
  const product = await CafeProduct.findById(item.product);
  if (product) {
    product.stockQuantity += item.quantity;
    await product.save();

    await Inventory.create({
      organizationId: session.organizationId,
      product: product._id,
      quantity: item.quantity,
      type: 'return',
      unitPrice: item.price,
      totalCost: item.subtotal,
      notes: 'Removed from session',
      createdBy: userId,
    });
  }

  session.cafeItems.splice(itemIndex, 1);
  await session.save();

  return session;
};

module.exports = { addCafeItemsToSession, removeCafeItem };