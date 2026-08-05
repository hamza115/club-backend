const { Membership, ActivityLog, Customer } = require('../models');
const { AppResponse } = require('../utils');
const asyncHandler = require('../middleware/asyncHandler');

const getMemberships = asyncHandler(async (req, res) => {
  const filter = { organizationId: req.orgId };
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const memberships = await Membership.find(filter).sort({ tier: 1 });
  AppResponse.success(res, { data: { memberships } });
});

const getMembership = asyncHandler(async (req, res) => {
  const membership = await Membership.findById(req.params.id);
  if (!membership) {
    return AppResponse.error(res, { message: 'Membership not found', statusCode: 404 });
  }
  AppResponse.success(res, { data: { membership } });
});

const createMembership = asyncHandler(async (req, res) => {
  const membership = await Membership.create({ ...req.body, organizationId: req.orgId });

  await ActivityLog.create({
    user: req.user._id,
    action: 'Membership created',
    module: 'membership',
    details: `Created membership: ${membership.name}`,
    resourceId: membership._id,
    resourceModel: 'Membership',
    ipAddress: req.ip,
  });

  AppResponse.created(res, { data: { membership } });
});

const updateMembership = asyncHandler(async (req, res) => {
  const membership = await Membership.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!membership) {
    return AppResponse.error(res, { message: 'Membership not found', statusCode: 404 });
  }

  AppResponse.success(res, { data: { membership }, message: 'Membership updated' });
});

const deleteMembership = asyncHandler(async (req, res) => {
  const membership = await Membership.findById(req.params.id);
  if (!membership) {
    return AppResponse.error(res, { message: 'Membership not found', statusCode: 404 });
  }

  const customersWithMembership = await Customer.countDocuments({ membership: membership._id });
  if (customersWithMembership > 0) {
    return AppResponse.error(res, {
      message: `Cannot delete. ${customersWithMembership} customer(s) have this membership`,
      statusCode: 400,
    });
  }

  membership.isActive = false;
  await membership.save();

  AppResponse.success(res, { message: 'Membership deactivated' });
});

module.exports = { getMemberships, getMembership, createMembership, updateMembership, deleteMembership };