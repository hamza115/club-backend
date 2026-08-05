const { AppResponse, logger } = require('../utils');

const errorHandler = (err, req, res, _next) => {
  logger.error(err.stack || err.message);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return AppResponse.error(res, {
      message: 'Validation failed',
      statusCode: 400,
      errors,
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return AppResponse.error(res, {
      message: `Duplicate value for field: ${field}`,
      statusCode: 409,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return AppResponse.error(res, {
      message: `Invalid ${err.path}: ${err.value}`,
      statusCode: 400,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return AppResponse.error(res, { message: 'Invalid token', statusCode: 401 });
  }

  if (err.name === 'TokenExpiredError') {
    return AppResponse.error(res, { message: 'Token expired', statusCode: 401 });
  }

  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Internal Server Error';

  return AppResponse.error(res, { message, statusCode });
};

module.exports = errorHandler;