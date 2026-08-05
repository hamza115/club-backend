const { body, query, param, validationResult } = require('express-validator');
const { AppResponse } = require('../utils');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return AppResponse.error(res, {
      message: 'Validation failed',
      statusCode: 400,
      errors: formatted,
    });
  }
  next();
};

const validate = (rules) => [...rules, handleValidation];

module.exports = { validate, body, query, param };