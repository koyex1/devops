// src/ws.js
const { WebSocketServer } = require("ws");
const url = require("url");

/**
 * Attach a raw WebSocket server to an existing Node HTTP server.
 * - Uses one port (same as Express)
 * - WebSocket path: /ws
 */
function attachWs(httpServer, { logger }) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    // If you need payloads bigger than the default
    maxPayload: 1024 * 1024, // 1MB
  });

  wss.on("connection", (socket, req) => {
    const { query } = url.parse(req.url, true);

    // OPTIONAL: simple token check via query string
    // ws://localhost:4000/ws?token=...
    const token = query.token;

    // If you want to enforce auth, uncomment and implement validateToken()
    // if (!validateToken(token)) {
    //   socket.close(1008, "Unauthorized");
    //   return;
    // }

    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (buf) => {
      // ws sends Buffer; convert to string
      const text = buf.toString("utf8");

      // Low-code JSON protocol:
      // client sends: {"type":"ping"} OR {"type":"echo","data":"hi"}
      let msg;
      try {
        msg = JSON.parse(text);
      } catch (e) {
        // if not JSON, just echo the raw text
        socket.send(text);
        return;
      }

      if (msg.type === "ping") {
        socket.send(JSON.stringify({ type: "pong", at: new Date().toISOString() }));
        return;
      }

      if (msg.type === "echo") {
        socket.send(JSON.stringify({ type: "echo", data: msg.data ?? null }));
        return;
      }

      // default: echo back
      socket.send(JSON.stringify({ type: "unknown", received: msg }));
    });

    socket.on("close", (code, reason) => {
      logger?.info?.({ code, reason: reason?.toString?.() }, "WS client disconnected");
    });

    socket.on("error", (err) => {
      logger?.error?.({ err }, "WS socket error");
    });

    // Welcome message
    socket.send(JSON.stringify({ type: "welcome", wsPath: "/ws" }));
    logger?.info?.({ ip: req.socket.remoteAddress }, "WS client connected");
  });

  // Heartbeat to kill dead connections (optional but good)
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  return wss;
}

module.exports = { attachWs };
