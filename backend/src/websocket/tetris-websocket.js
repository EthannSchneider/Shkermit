import { randomInt } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 5;
const MAX_MESSAGES_PER_SECOND = 120;
const VALID_ACTIONS = new Set(["left", "right", "rotate", "down", "drop"]);
const VALID_COMMANDS = new Set(["toggle_pause", "restart", "frog_flush"]);

function makeRoomCode(rooms) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = "";
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error("Unable to allocate a multiplayer room code.");
}

function send(socket, message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function normalizeRoomCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isCoopGameState(value) {
  return Boolean(
    value
    && typeof value === "object"
    && value.mode === "coop"
    && value.cols === 14
    && Array.isArray(value.board)
    && value.board.length === 20
    && value.board.every((row) => Array.isArray(row) && row.length === 14)
    && Array.isArray(value.active)
    && typeof value.status === "string"
    && Number.isFinite(value.score)
    && Number.isFinite(value.lines),
  );
}

export function createTetrisWebSocketServer(httpServer, { heartbeatMs = 30_000 } = {}) {
  const rooms = new Map();
  const clients = new WeakMap();
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  const leaveRoom = (socket) => {
    const client = clients.get(socket);
    if (!client?.roomCode) return;
    const room = rooms.get(client.roomCode);
    if (!room) return;

    if (client.playerId === 1) {
      send(room.guest, { type: "room_closed", reason: "The host left the pond." });
      rooms.delete(client.roomCode);
    } else if (room.guest === socket) {
      room.guest = null;
      send(room.host, { type: "peer_left", playerId: 2 });
    }
  };

  webSocketServer.on("connection", (socket) => {
    clients.set(socket, {
      roomCode: null,
      playerId: null,
      alive: true,
      messageWindowStartedAt: Date.now(),
      messageCount: 0,
    });

    socket.on("pong", () => {
      const client = clients.get(socket);
      if (client) client.alive = true;
    });

    socket.on("message", (rawMessage) => {
      const client = clients.get(socket);
      if (!client) return;

      const now = Date.now();
      if (now - client.messageWindowStartedAt >= 1_000) {
        client.messageWindowStartedAt = now;
        client.messageCount = 0;
      }
      client.messageCount += 1;
      if (client.messageCount > MAX_MESSAGES_PER_SECOND) {
        socket.close(1008, "Too many messages");
        return;
      }

      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch {
        send(socket, { type: "error", message: "That multiplayer message was not valid." });
        return;
      }

      if (!message || typeof message !== "object" || typeof message.type !== "string") return;

      if (message.type === "create") {
        if (client.roomCode) return;
        const roomCode = makeRoomCode(rooms);
        rooms.set(roomCode, { host: socket, guest: null });
        client.roomCode = roomCode;
        client.playerId = 1;
        send(socket, { type: "room_created", roomCode, playerId: 1 });
        return;
      }

      if (message.type === "join") {
        if (client.roomCode) return;
        const roomCode = normalizeRoomCode(message.roomCode);
        const room = rooms.get(roomCode);
        if (!room || room.host.readyState !== WebSocket.OPEN) {
          send(socket, { type: "error", message: "That pond could not be found." });
          return;
        }
        if (room.guest?.readyState === WebSocket.OPEN) {
          send(socket, { type: "error", message: "That pond already has two frogs." });
          return;
        }

        room.guest = socket;
        client.roomCode = roomCode;
        client.playerId = 2;
        send(socket, { type: "room_joined", roomCode, playerId: 2 });
        send(room.host, { type: "peer_joined", playerId: 2 });
        return;
      }

      if (!client.roomCode || !client.playerId) return;
      const room = rooms.get(client.roomCode);
      if (!room?.guest || room.guest.readyState !== WebSocket.OPEN) return;

      if (message.type === "action" && VALID_ACTIONS.has(message.action)) {
        send(room.host, {
          type: "player_action",
          playerId: client.playerId,
          action: message.action,
        });
        return;
      }

      if (message.type === "command" && VALID_COMMANDS.has(message.command)) {
        send(room.host, {
          type: "game_command",
          playerId: client.playerId,
          command: message.command,
        });
        return;
      }

      if (message.type === "state" && client.playerId === 1 && isCoopGameState(message.state)) {
        send(room.guest, { type: "game_state", state: message.state });
      }
    });

    socket.on("close", () => leaveRoom(socket));
  });

  const onUpgrade = (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== "/ws/tetris") {
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  };
  httpServer.on("upgrade", onUpgrade);

  const heartbeat = setInterval(() => {
    webSocketServer.clients.forEach((socket) => {
      const client = clients.get(socket);
      if (!client?.alive) {
        socket.terminate();
        return;
      }
      client.alive = false;
      socket.ping();
    });
  }, heartbeatMs);
  heartbeat.unref();

  return {
    close() {
      clearInterval(heartbeat);
      httpServer.off("upgrade", onUpgrade);
      webSocketServer.clients.forEach((socket) => socket.terminate());
      webSocketServer.close();
      rooms.clear();
    },
  };
}
