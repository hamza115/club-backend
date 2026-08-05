const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const { AppResponse } = require('../utils');
const asyncHandler = require('./asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return AppResponse.error(res, { message: 'Not authorized, no token provided', statusCode: 401 });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return AppResponse.error(res, { message: 'User not found', statusCode: 401 });
    }

    if (!user.isActive) {
      return AppResponse.error(res, { message: 'Account has been deactivated', statusCode: 403 });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return AppResponse.error(res, { message: 'Token expired', statusCode: 401 });
    }
    return AppResponse.error(res, { message: 'Invalid token', statusCode: 401 });
  }
});

module.exports = auth;