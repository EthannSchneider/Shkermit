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
  multiplayer = createTetrisWebSocketServer(server, { heartbeatMs: 60_000, reconnectGraceMs: 1_000 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  socketUrl = `ws://127.0.0.1:${address.port}/ws/tetris`;
});

after(async () => {
  openSockets.forEach((socket) => socket.terminate());
  multiplayer.close();
  await new Promise((resolve) => server.close(resolve));
});

test("creates a two-player co-op room and relays inputs through its host", async () => {
  const host = await connect();
  send(host, { type: "create" });
  const created = await nextMessage(host, "room_created");
  assert.match(created.roomCode, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(created.playerId, 1);
  assert.equal(created.gameMode, "coop");
  assert.equal(typeof created.resumeToken, "string");

  const peerJoined = nextMessage(host, "peer_joined");
  const guest = await connect();
  send(guest, { type: "join", roomCode: created.roomCode.toLowerCase() });
  const joined = await nextMessage(guest, "room_joined");
  assert.equal(joined.roomCode, created.roomCode);
  assert.equal(joined.playerId, 2);
  assert.equal(joined.gameMode, "coop");
  assert.equal(typeof joined.resumeToken, "string");
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

test("creates duel rooms and tells the joining player which mode to load", async () => {
  const host = await connect();
  send(host, { type: "create", gameMode: "duel" });
  const created = await nextMessage(host, "room_created");
  assert.equal(created.gameMode, "duel");

  const peerJoined = nextMessage(host, "peer_joined");
  const guest = await connect();
  send(guest, { type: "join", roomCode: created.roomCode });
  const joined = await nextMessage(guest, "room_joined");
  assert.equal(joined.gameMode, "duel");
  assert.equal((await peerJoined).gameMode, "duel");

  const emptyBoard = () => Array.from({ length: 20 }, () => Array(10).fill(null));
  const state = {
    mode: "duel",
    cols: 10,
    board: emptyBoard(),
    duelBoards: { 1: emptyBoard(), 2: emptyBoard() },
    active: [],
    status: "playing",
    score: 0,
    lines: 0,
  };
  const snapshot = nextMessage(guest, "game_state");
  send(host, { type: "state", state });
  assert.deepEqual((await snapshot).state, state);

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

test("restores either player and the latest board after a refresh", async () => {
  const host = await connect();
  send(host, { type: "create", gameMode: "duel" });
  const created = await nextMessage(host, "room_created");
  const peerJoined = nextMessage(host, "peer_joined");
  const guest = await connect();
  send(guest, { type: "join", roomCode: created.roomCode });
  const joined = await nextMessage(guest, "room_joined");
  await peerJoined;

  const emptyBoard = () => Array.from({ length: 20 }, () => Array(10).fill(null));
  const state = {
    mode: "duel",
    cols: 10,
    board: emptyBoard(),
    duelBoards: { 1: emptyBoard(), 2: emptyBoard() },
    active: [],
    status: "playing",
    score: 450,
    lines: 3,
  };
  const initialSnapshot = nextMessage(guest, "game_state");
  send(host, { type: "state", state });
  await initialSnapshot;

  const guestLeft = nextMessage(host, "peer_left");
  guest.close();
  assert.equal((await guestLeft).reconnecting, true);

  const guestRejoined = nextMessage(host, "peer_rejoined");
  const resumedGuest = await connect();
  send(resumedGuest, {
    type: "resume",
    roomCode: created.roomCode,
    resumeToken: joined.resumeToken,
  });
  const guestResume = await nextMessage(resumedGuest, "room_resumed");
  assert.equal(guestResume.playerId, 2);
  assert.deepEqual(guestResume.state, state);
  await guestRejoined;

  const hostLeft = nextMessage(resumedGuest, "peer_left");
  host.close();
  assert.equal((await hostLeft).playerId, 1);

  const hostRejoined = nextMessage(resumedGuest, "peer_rejoined");
  const resumedHost = await connect();
  send(resumedHost, {
    type: "resume",
    roomCode: created.roomCode,
    resumeToken: created.resumeToken,
  });
  const hostResume = await nextMessage(resumedHost, "room_resumed");
  assert.equal(hostResume.playerId, 1);
  assert.deepEqual(hostResume.state, state);
  await hostRejoined;

  resumedHost.close();
  resumedGuest.close();
});

test("releases seats immediately when a player intentionally leaves", async () => {
  const host = await connect();
  send(host, { type: "create" });
  const created = await nextMessage(host, "room_created");
  const firstPeerJoined = nextMessage(host, "peer_joined");
  const guest = await connect();
  send(guest, { type: "join", roomCode: created.roomCode });
  await nextMessage(guest, "room_joined");
  await firstPeerJoined;

  const peerLeft = nextMessage(host, "peer_left");
  send(guest, { type: "leave" });
  assert.equal((await peerLeft).reconnecting, false);

  const secondPeerJoined = nextMessage(host, "peer_joined");
  const replacementGuest = await connect();
  send(replacementGuest, { type: "join", roomCode: created.roomCode });
  assert.equal((await nextMessage(replacementGuest, "room_joined")).playerId, 2);
  await secondPeerJoined;

  const roomClosed = nextMessage(replacementGuest, "room_closed");
  send(host, { type: "leave" });
  assert.match((await roomClosed).reason, /host left/i);
  replacementGuest.close();
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
