const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('./jwt');

let io = null;

/**
 * Attach a Socket.IO server to the given HTTP server. Every video in this
 * app is visible to every authenticated user (GET /api/videos has no
 * per-user filtering), so analysis events are broadcast to all connected
 * sockets rather than scoped to per-video rooms — that mirrors the existing
 * REST API's visibility model instead of inventing a stricter one just for
 * the socket layer.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || '*' },
  });

  // Mirrors middleware/auth.js's requireAuth: same JWT, same "user must
  // still exist" check, just adapted to Socket.IO's handshake-time hook
  // instead of a per-request Express middleware.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, getJwtSecret());
      const user = await User.findById(payload.id);
      if (!user) return next(new Error('User no longer exists'));
      socket.userId = String(user._id);
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  return io;
}

function getIO() {
  return io;
}

/**
 * Best-effort broadcast: analysis progress is a nice-to-have UX layer over
 * the authoritative REST/poll flow, so a socket server that hasn't been
 * initialized (e.g. under Jest, which only boots app.js) is a silent no-op
 * rather than an error.
 */
function emitEvent(event, payload) {
  if (io) io.emit(event, payload);
}

module.exports = { initSocket, getIO, emitEvent };
