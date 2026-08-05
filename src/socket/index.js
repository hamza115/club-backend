const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

function setupSocket(io) {
  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      socket.user = decoded;
      socket.userId = decoded.id;

      // organizationId from JWT (new tokens include it), fallback to DB lookup
      if (!socket.user.organizationId) {
        const user = await User.findById(decoded.id).select('organizationId');
        if (user) {
          socket.user.organizationId = user.organizationId;
        }
      }

      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const orgId = socket.user.organizationId;
    if (!orgId) {
      socket.disconnect();
      return;
    }

    // Join organization room
    const room = `org:${orgId}`;
    socket.join(room);

    // Leave on disconnect
    socket.on('disconnect', () => {
      socket.leave(room);
    });
  });
}

/**
 * Emit a session event to all users in an organization.
 * @param {import('socket.io').Server} io
 * @param {string} orgId - Organization ID
 * @param {string} event - Event name (session:started, session:paused, session:resumed, session:ended, session:updated)
 * @param {object} data - Event payload
 */
function emitToOrg(io, orgId, event, data) {
  if (!io || !orgId) return;
  io.to(`org:${orgId}`).emit(event, data);
}

/**
 * Emit an event to all socket connections of a specific user.
 * @param {import('socket.io').Server} io
 * @param {string} orgId - Organization ID
 * @param {string} userId - Target User ID
 * @param {string} event - Event name
 * @param {object} data - Event payload
 */
function emitToUser(io, orgId, userId, event, data) {
  if (!io || !orgId || !userId) return;
  const sockets = io.sockets.adapter.rooms.get(`org:${orgId}`);
  if (sockets) {
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && String(socket.userId) === String(userId)) {
        socket.emit(event, data);
      }
    }
  }
}

module.exports = { setupSocket, emitToOrg, emitToUser };
