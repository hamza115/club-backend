require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  // MongoDB
  mongoUri: process.env.MONGO_URI,

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',

  // Bcrypt
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',

  // Business
  defaultTaxRate: parseFloat(process.env.DEFAULT_TAX_RATE) || 0,
  clubName: process.env.CLUB_NAME || 'Cuemaster Elite',
  clubCurrency: process.env.CLUB_CURRENCY || 'PKR',
};

module.exports = env;