const { SupplierContact, ActivityLog } = require('../models');
const { AppResponse, parsePagination } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');

const getSuppliers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = {
    organizationId: req.orgId,
    isActive: true,
  };

  const [records, total] = await Promise.all([
    SupplierContact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name role')
      .populate('updatedBy', 'name role'),
    SupplierContact.countDocuments(filter),
  ]);

  AppResponse.paginated(res, { data: records, pagination: { page, limit, total } });
});

const createSupplier = asyncHandler(async (req, res) => {
  const { name, contactNumber, note } = req.body;

  const supplier = await SupplierContact.create({
    organizationId: req.orgId,
    name,
    contactNumber,
    note: note || '',
    createdBy: req.user._id,
  });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Supplier added',
    module: 'inventory',
    details: `Added supplier contact ${name}`,
    resourceId: supplier._id,
    resourceModel: 'SupplierContact',
    ipAddress: req.ip,
  });

  AppResponse.created(res, { data: supplier, message: 'Supplier contact added' });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const { name, contactNumber, note, isActive } = req.body;

  const supplier = await SupplierContact.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.orgId },
    {
      ...(name !== undefined ? { name } : {}),
      ...(contactNumber !== undefined ? { contactNumber } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      updatedBy: req.user._id,
    },
    { new: true, runValidators: true },
  );

  if (!supplier) {
    return AppResponse.error(res, { message: 'Supplier contact not found', statusCode: 404 });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'Supplier updated',
    module: 'inventory',
    details: `Updated supplier contact ${supplier.name}`,
    resourceId: supplier._id,
    resourceModel: 'SupplierContact',
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: supplier, message: 'Supplier contact updated' });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierContact.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.orgId },
    { isActive: false, updatedBy: req.user._id },
    { new: true },
  );

  if (!supplier) {
    return AppResponse.error(res, { message: 'Supplier contact not found', statusCode: 404 });
  }

  await ActivityLog.create({
    user: req.user._id,
    action: 'Supplier deactivated',
    module: 'inventory',
    details: `Deactivated supplier contact ${supplier.name}`,
    resourceId: supplier._id,
    resourceModel: 'SupplierContact',
    ipAddress: req.ip,
  });

  AppResponse.success(res, { data: supplier, message: 'Supplier contact removed' });
});

module.exports = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
