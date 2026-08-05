const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const createApp = () => {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  if (env.nodeEnv !== 'production') {
    app.use(morgan('dev'));
  }

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMax,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // API routes
  app.use('/api', routes);

  // Root
  app.get('/', (req, res) => {
    res.json({
      name: env.clubName,
      version: '1.0.0',
      endpoints: '/api',
      health: '/api/health',
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};

module.exports = createApp;