const { AppResponse } = require('../utils');

const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return AppResponse.error(res, { message: 'Authentication required', statusCode: 401 });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return AppResponse.error(res, {
        message: 'You do not have permission to perform this action',
        statusCode: 403,
      });
    }

    next();
  };
};

module.exports = roleGuard;