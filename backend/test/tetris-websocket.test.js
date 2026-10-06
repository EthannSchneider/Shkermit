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

async function createJoinedRoom(gameMode = "coop") {
  const host = await connect();
  send(host, { type: "create", gameMode });
  const created = await nextMessage(host, "room_created");
  const peerJoined = nextMessage(host, "peer_joined");
  const initialHostState = nextMessage(host, "game_state");

  const guest = await connect();
  const initialGuestState = nextMessage(guest, "game_state");
  send(guest, { type: "join", roomCode: created.roomCode.toLowerCase() });
  const joined = await nextMessage(guest, "room_joined");

  await peerJoined;
  const [hostSnapshot, guestSnapshot] = await Promise.all([initialHostState, initialGuestState]);
  assert.deepEqual(hostSnapshot.state, guestSnapshot.state);
  return { host, guest, created, joined, state: hostSnapshot.state };
}

before(async () => {
  server = createServer((_request, response) => response.end("ok"));
  multiplayer = createTetrisWebSocketServer(server, {
    heartbeatMs: 60_000,
    reconnectGraceMs: 1_000,
    gameLoopMs: 10_000,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  socketUrl = `ws://127.0.0.1:${address.port}/ws/tetris`;
});

after(async () => {
  openSockets.forEach((socket) => socket.terminate());
  multiplayer.close();
  await new Promise((resolve) => server.close(resolve));
});

test("creates a server-authoritative co-op game and applies each player's input", async () => {
  const { host, guest, created, joined, state } = await createJoinedRoom();
  assert.match(created.roomCode, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(created.playerId, 1);
  assert.equal(created.gameMode, "coop");
  assert.equal(typeof created.resumeToken, "string");
  assert.equal(joined.roomCode, created.roomCode);
  assert.equal(joined.playerId, 2);
  assert.equal(joined.gameMode, "coop");
  assert.equal(typeof joined.resumeToken, "string");

  assert.equal(state.mode, "coop");
  assert.equal(state.status, "playing");
  assert.equal(state.active.length, 2);
  const playerTwoBefore = state.active.find((piece) => piece.player === 2);
  const movedGuest = nextMessage(host, "game_state");
  const movedGuestEcho = nextMessage(guest, "game_state");
  send(guest, { type: "action", action: "left" });
  const afterGuestMove = (await movedGuest).state;
  await movedGuestEcho;
  assert.equal(
    afterGuestMove.active.find((piece) => piece.player === 2).x,
    playerTwoBefore.x - 1,
  );

  const droppedHost = nextMessage(guest, "game_state");
  send(host, { type: "action", action: "drop" });
  const afterHostDrop = (await droppedHost).state;
  assert.equal(afterHostDrop.board.some((row) => row.some((cell) => cell?.owner === 1)), true);

  host.close();
  guest.close();
});

test("creates isolated duel boards controlled by the backend", async () => {
  const { host, guest, created, joined, state } = await createJoinedRoom("duel");
  assert.equal(created.gameMode, "duel");
  assert.equal(joined.gameMode, "duel");
  assert.equal(state.mode, "duel");
  assert.equal(state.duelBoards[1].length, 20);
  assert.equal(state.duelBoards[2].length, 20);
  const playerOneBefore = state.active.find((piece) => piece.player === 1);
  const playerTwoBefore = state.active.find((piece) => piece.player === 2);

  const moved = nextMessage(guest, "game_state");
  send(host, { type: "action", action: "left" });
  const nextState = (await moved).state;
  assert.equal(nextState.active.find((piece) => piece.player === 1).x, playerOneBefore.x - 1);
  assert.equal(nextState.active.find((piece) => piece.player === 2).x, playerTwoBefore.x);

  host.close();
  guest.close();
});

test("rejects client-provided snapshots and pauses safely on disconnect", async () => {
  const { host, guest } = await createJoinedRoom();
  const rejected = nextMessage(host, "error");
  send(host, {
    type: "state",
    state: { mode: "coop", score: 999_999, lines: 999, status: "gameover" },
  });
  assert.match((await rejected).message, /not accepted/i);

  const peerLeft = nextMessage(host, "peer_left");
  const paused = nextMessage(host, "game_state");
  guest.close();
  await peerLeft;
  assert.equal((await paused).state.status, "paused");
  host.close();
});

test("validates multiplayer commands against the server-owned game state", async () => {
  const { host, guest } = await createJoinedRoom();
  const pausedAtHost = nextMessage(host, "game_state");
  const pausedAtGuest = nextMessage(guest, "game_state");
  send(guest, { type: "command", command: "toggle_pause" });
  assert.equal((await pausedAtHost).state.status, "paused");
  await pausedAtGuest;

  const restartedAtHost = nextMessage(host, "game_state");
  const restartedAtGuest = nextMessage(guest, "game_state");
  send(host, { type: "command", command: "restart" });
  const restarted = (await restartedAtHost).state;
  await restartedAtGuest;
  assert.equal(restarted.status, "playing");
  assert.equal(restarted.score, 0);
  assert.equal(restarted.lines, 0);
  assert.equal(restarted.active.length, 2);

  host.close();
  guest.close();
});

test("restores either player and the latest board after a refresh", async () => {
  const { host, guest, created, joined } = await createJoinedRoom("duel");
  const authoritativeUpdate = nextMessage(guest, "game_state");
  send(host, { type: "action", action: "drop" });
  await authoritativeUpdate;

  const guestLeft = nextMessage(host, "peer_left");
  const pausedSnapshot = nextMessage(host, "game_state");
  guest.close();
  assert.equal((await guestLeft).reconnecting, true);
  const pausedState = (await pausedSnapshot).state;

  const guestRejoined = nextMessage(host, "peer_rejoined");
  const resumedGuest = await connect();
  send(resumedGuest, {
    type: "resume",
    roomCode: created.roomCode,
    resumeToken: joined.resumeToken,
  });
  const guestResume = await nextMessage(resumedGuest, "room_resumed");
  assert.equal(guestResume.playerId, 2);
  assert.deepEqual(guestResume.state, pausedState);
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
  assert.deepEqual(hostResume.state, pausedState);
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
