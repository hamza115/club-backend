const { AppResponse } = require('../utils');

/**
 * Attaches req.orgId from the authenticated user's organizationId.
 * All organization-scoped controllers should use this to filter queries.
 */
const orgScope = (req, res, next) => {
  if (!req.user || !req.user.organizationId) {
    return AppResponse.error(res, { message: 'User is not associated with an organization', statusCode: 403 });
  }
  req.orgId = req.user.organizationId;
  next();
};

module.exports = orgScope;
