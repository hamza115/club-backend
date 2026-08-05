const dns = require('dns');
const mongoose = require('mongoose');
const { ServerApiVersion } = require('mongodb');
const env = require('./env');
const logger = require('../utils/logger');

// Force Google DNS for Node.js c-ares resolver (fixes SRV lookup failures)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const options = {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    };

    const conn = await mongoose.connect(env.mongoUri, options);
    logger.info(`MongoDB connected: ${conn.connection.host}`);

    // Ping to confirm connection
    await conn.connection.db.admin().command({ ping: 1 });
    logger.info('MongoDB ping successful');
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    if (error.message.includes('querySrv') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      logger.error('DNS resolution failed. Check your MongoDB Atlas connection string.');
      logger.error('Verify: 1) Cluster exists 2) Network allows DNS queries 3) IP is whitelisted in Atlas');
    }
    process.exit(1);
  }
};

module.exports = connectDB;