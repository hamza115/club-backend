const http = require('http');
const { Server } = require('socket.io');
const createApp = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const { logger } = require('./utils');
const { setupSocket } = require('./socket');

const startServer = async () => {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setupSocket(io);

  // Make io accessible from controllers
  app.set('io', io);

  server.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
    logger.info(`API: http://localhost:${env.port}/api`);
    logger.info(`Socket.IO: ws://localhost:${env.port}`);
  });
};

startServer();
