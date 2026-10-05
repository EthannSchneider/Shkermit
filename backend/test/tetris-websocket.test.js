import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { WebSocket } from "ws";
import { createTetrisWebSocketServer } from "../src/websocket/tetris-websocket.js";

let server;
let multiplayer;
let socketUrl;
const openSockets = new Set();

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl);
    openSockets.add(socket);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
    socket.once("close", () => openSockets.delete(socket));
  });
}

function nextMessage(socket, expectedType) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error(`Timed out waiting for ${expectedType}`));
    }, 2_000);
    const onMessage = (rawMessage) => {
      const message = JSON.parse(rawMessage.toString());
      if (message.type !== expectedType) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

before(async () => {
  server = createServer((_request, response) => response.end("ok"));
  multiplayer = createTetrisWebSocketServer(server, { heartbeatMs: 60_000 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  socketUrl = `ws://127.0.0.1:${address.port}/ws/tetris`;
});

after(async () => {
  openSockets.forEach((socket) => socket.terminate());
  multiplayer.close();
  await new Promise((resolve) => server.close(resolve));
});

test("creates a two-player room and relays inputs through its host", async () => {
  const host = await connect();
  send(host, { type: "create" });
  const created = await nextMessage(host, "room_created");
  assert.match(created.roomCode, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(created.playerId, 1);

  const peerJoined = nextMessage(host, "peer_joined");
  const guest = await connect();
  send(guest, { type: "join", roomCode: created.roomCode.toLowerCase() });
  const joined = await nextMessage(guest, "room_joined");
  assert.equal(joined.roomCode, created.roomCode);
  assert.equal(joined.playerId, 2);
  await peerJoined;

  const relayedAction = nextMessage(host, "player_action");
  send(guest, { type: "action", action: "left" });
  assert.deepEqual(await relayedAction, { type: "player_action", playerId: 2, action: "left" });

  const relayedHostAction = nextMessage(host, "player_action");
  send(host, { type: "action", action: "drop" });
  assert.deepEqual(await relayedHostAction, { type: "player_action", playerId: 1, action: "drop" });

  const relayedCommand = nextMessage(host, "game_command");
  send(guest, { type: "command", command: "frog_flush" });
  assert.equal((await relayedCommand).command, "frog_flush");

  host.close();
  guest.close();
});

test("only accepts valid host snapshots and reports room disconnects", async () => {
  const host = await connect();
  send(host, { type: "create" });
  const { roomCode } = await nextMessage(host, "room_created");
  const peerJoined = nextMessage(host, "peer_joined");
  const guest = await connect();
  send(guest, { type: "join", roomCode });
  await nextMessage(guest, "room_joined");
  await peerJoined;

  const state = {
    mode: "coop",
    cols: 14,
    board: Array.from({ length: 20 }, () => Array(14).fill(null)),
    active: [],
    status: "playing",
    score: 120,
    lines: 1,
  };
  const snapshot = nextMessage(guest, "game_state");
  send(host, { type: "state", state });
  assert.deepEqual((await snapshot).state, state);

  const peerLeft = nextMessage(host, "peer_left");
  guest.close();
  await peerLeft;
  host.close();
});

test("rejects missing and full rooms", async () => {
  const missingGuest = await connect();
  send(missingGuest, { type: "join", roomCode: "NOPE2" });
  assert.match((await nextMessage(missingGuest, "error")).message, /could not be found/i);
  missingGuest.close();

  const host = await connect();
  send(host, { type: "create" });
  const { roomCode } = await nextMessage(host, "room_created");
  const peerJoined = nextMessage(host, "peer_joined");
  const firstGuest = await connect();
  send(firstGuest, { type: "join", roomCode });
  await nextMessage(firstGuest, "room_joined");
  await peerJoined;

  const extraGuest = await connect();
  send(extraGuest, { type: "join", roomCode });
  assert.match((await nextMessage(extraGuest, "error")).message, /already has two frogs/i);

  host.close();
  firstGuest.close();
  extraGuest.close();
});
