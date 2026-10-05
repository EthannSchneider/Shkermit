import { randomBytes, randomInt } from "node:crypto";
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

function makeResumeToken() {
  return randomBytes(24).toString("base64url");
}

function isMultiplayerGameState(value) {
  return Boolean(
    value
    && typeof value === "object"
    && (value.mode === "coop" || value.mode === "duel")
    && value.cols === (value.mode === "duel" ? 10 : 14)
    && Array.isArray(value.board)
    && value.board.length === 20
    && value.board.every((row) => Array.isArray(row) && row.length === value.cols)
    && (value.mode !== "duel"
      || (value.duelBoards
        && [value.duelBoards[1], value.duelBoards[2]].every((board) => (
          Array.isArray(board)
          && board.length === 20
          && board.every((row) => Array.isArray(row) && row.length === 10)
        ))))
    && Array.isArray(value.active)
    && typeof value.status === "string"
    && Number.isFinite(value.score)
    && Number.isFinite(value.lines),
  );
}

export function createTetrisWebSocketServer(httpServer, {
  heartbeatMs = 30_000,
  reconnectGraceMs = 30_000,
} = {}) {
  const rooms = new Map();
  const clients = new WeakMap();
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  const clearRoomTimers = (room) => {
    if (room.hostReconnectTimer) clearTimeout(room.hostReconnectTimer);
    if (room.guestReconnectTimer) clearTimeout(room.guestReconnectTimer);
  };

  const deleteRoom = (roomCode, reason) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    clearRoomTimers(room);
    send(room.host, { type: "room_closed", reason });
    send(room.guest, { type: "room_closed", reason });
    rooms.delete(roomCode);
  };

  const leaveRoom = (socket, { immediate = false } = {}) => {
    const client = clients.get(socket);
    if (!client?.roomCode) return;
    const room = rooms.get(client.roomCode);
    if (!room) return;
    const roomCode = client.roomCode;
    client.roomCode = null;

    if (client.playerId === 1) {
      if (room.host !== socket) return;
      room.host = null;
      send(room.guest, { type: "peer_left", playerId: 1, reconnecting: !immediate });
      if (immediate) {
        deleteRoom(roomCode, "The host left the room.");
        return;
      }
      room.hostReconnectTimer = setTimeout(() => {
        deleteRoom(roomCode, "The host did not reconnect in time.");
      }, reconnectGraceMs);
      room.hostReconnectTimer.unref?.();
    } else if (room.guest === socket) {
      room.guest = null;
      send(room.host, { type: "peer_left", playerId: 2, reconnecting: !immediate });
      if (immediate) {
        room.guestToken = null;
        return;
      }
      room.guestReconnectTimer = setTimeout(() => {
        const currentRoom = rooms.get(roomCode);
        if (!currentRoom || currentRoom.guest) return;
        currentRoom.guestToken = null;
        currentRoom.guestReconnectTimer = null;
        send(currentRoom.host, { type: "peer_expired", playerId: 2 });
      }, reconnectGraceMs);
      room.guestReconnectTimer.unref?.();
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
        const gameMode = message.gameMode === "duel" ? "duel" : "coop";
        const resumeToken = makeResumeToken();
        rooms.set(roomCode, {
          host: socket,
          guest: null,
          hostToken: resumeToken,
          guestToken: null,
          hostReconnectTimer: null,
          guestReconnectTimer: null,
          gameMode,
          lastState: null,
        });
        client.roomCode = roomCode;
        client.playerId = 1;
        send(socket, { type: "room_created", roomCode, playerId: 1, gameMode, resumeToken });
        return;
      }

      if (message.type === "join") {
        if (client.roomCode) return;
        const roomCode = normalizeRoomCode(message.roomCode);
        const room = rooms.get(roomCode);
        if (!room || room.host?.readyState !== WebSocket.OPEN) {
          send(socket, { type: "error", message: "That room could not be found." });
          return;
        }
        if (room.guest?.readyState === WebSocket.OPEN || room.guestToken) {
          send(socket, { type: "error", message: "That room already has two frogs." });
          return;
        }

        const resumeToken = makeResumeToken();
        room.guest = socket;
        room.guestToken = resumeToken;
        client.roomCode = roomCode;
        client.playerId = 2;
        send(socket, { type: "room_joined", roomCode, playerId: 2, gameMode: room.gameMode, resumeToken });
        send(room.host, { type: "peer_joined", playerId: 2, gameMode: room.gameMode });
        return;
      }

      if (message.type === "resume") {
        if (client.roomCode) return;
        const roomCode = normalizeRoomCode(message.roomCode);
        const room = rooms.get(roomCode);
        const token = typeof message.resumeToken === "string" ? message.resumeToken : "";
        const playerId = token && token === room?.hostToken ? 1 : token && token === room?.guestToken ? 2 : null;
        if (!room || !playerId) {
          send(socket, { type: "resume_rejected", message: "That saved multiplayer room has expired." });
          return;
        }
        const seat = playerId === 1 ? "host" : "guest";
        const previousSocket = room[seat];
        if (previousSocket?.readyState === WebSocket.OPEN) {
          const previousClient = clients.get(previousSocket);
          if (previousClient) previousClient.roomCode = null;
          previousSocket.close(4000, "Connection resumed in another page");
        }

        const timerKey = playerId === 1 ? "hostReconnectTimer" : "guestReconnectTimer";
        if (room[timerKey]) clearTimeout(room[timerKey]);
        room[timerKey] = null;
        room[seat] = socket;
        client.roomCode = roomCode;
        client.playerId = playerId;
        const peer = playerId === 1 ? room.guest : room.host;
        send(socket, {
          type: "room_resumed",
          roomCode,
          playerId,
          gameMode: room.gameMode,
          resumeToken: token,
          peerConnected: peer?.readyState === WebSocket.OPEN,
          state: room.lastState,
        });
        send(peer, { type: "peer_rejoined", playerId });
        return;
      }

      if (message.type === "leave") {
        leaveRoom(socket, { immediate: true });
        socket.close(1000, "Left the room");
        return;
      }

      if (!client.roomCode || !client.playerId) return;
      const room = rooms.get(client.roomCode);
      if (!room) return;

      if (message.type === "state"
        && client.playerId === 1
        && message.state?.mode === room.gameMode
        && isMultiplayerGameState(message.state)) {
        room.lastState = message.state;
        send(room.guest, { type: "game_state", state: message.state });
        return;
      }

      if (!room.guest || room.guest.readyState !== WebSocket.OPEN || !room.host || room.host.readyState !== WebSocket.OPEN) return;

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
      rooms.forEach(clearRoomTimers);
      rooms.clear();
    },
  };
}
