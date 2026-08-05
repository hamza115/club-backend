const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const generateToken = (userId, role, organizationId) => {
  return jwt.sign({ id: userId, role, organizationId }, env.jwtSecret, {
    expiresIn: env.jwtExpire,
  });
};

const generateRefreshToken = (userId, role, organizationId) => {
  return jwt.sign({ id: userId, role, organizationId }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpire,
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, env.jwtSecret);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.jwtRefreshSecret);
};

const generateResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
  return { resetToken, hashedToken, expiresAt };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  generateResetToken,
};