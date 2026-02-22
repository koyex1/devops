const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

function initSocket(httpServer, deps) {
  const { logger } = deps;

  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });

  io.use((socket, next) => {
    // Popular WS auth pattern: token in handshake auth
    const token = socket.handshake.auth?.token || socket.handshake.headers?.token || null;
    if (!token) return next(new Error("Missing token"));

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE
      });
      socket.user = user;
      return next();
    } catch (e) {
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Action: connect
    logger.info({ sub: socket.user.sub }, "socket connected");

    // Action: join room
    socket.on("room:join", (room, ack) => {
      socket.join(String(room));
      // Action: ack (request/response style)
      if (typeof ack === "function") ack({ ok: true, room });
    });

    // Action: leave room
    socket.on("room:leave", (room, ack) => {
      socket.leave(String(room));
      if (typeof ack === "function") ack({ ok: true, room });
    });

    // Action: emit -> server receives then broadcasts
    socket.on("chat:send", (payload, ack) => {
      const room = String(payload?.room || "lobby");
      const msg = String(payload?.message || "").slice(0, 200);

      // Action: broadcast to room
      io.to(room).emit("chat:message", {
        from: socket.user.sub,
        room,
        message: msg,
        ts: new Date().toISOString()
      });

      if (typeof ack === "function") ack({ ok: true });
    });

    // Action: disconnect
    socket.on("disconnect", (reason) => {
      logger.info({ reason, sub: socket.user.sub }, "socket disconnected");
    });
  });

  return io;
}

module.exports = { initSocket };
