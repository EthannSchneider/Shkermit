import assert from "node:assert/strict";
import test from "node:test";
import { commandTetrisGame, createTetrisGame, moveTetrisPlayer, tickTetrisGame } from "../src/services/tetris-game.service.js";

function groundedGame(mode = "duel") {
  const game = createTetrisGame(mode);
  game.state.active[0] = { type: "O", player: 1, rotation: 0, x: 3, y: 18, lockElapsed: 0, lockResets: 0 };
  return game;
}

const piece = (game, player = 1) => game.state.active.find((item) => item.player === player);
const board = (game, player = 1) => game.state.mode === "duel" ? game.state.duelBoards[player] : game.state.board;

for (const mode of ["coop", "duel"]) {
  test(`${mode}: contact and blocked soft drops wait 500 ms before locking`, () => {
    const game = groundedGame(mode);
    assert.equal(moveTetrisPlayer(game, 1, "down"), false);
    tickTetrisGame(game, 499);
    assert.equal(board(game).flat().filter(Boolean).length, 0);
    assert.equal(piece(game).y, 18);
    tickTetrisGame(game, 1);
    assert.equal(board(game).flat().filter(Boolean).length, 4);
    assert.equal(piece(game).lockElapsed, 0);
  });

  test(`${mode}: successful moves and rotations reset the delay; blocked moves do not`, () => {
    const game = groundedGame(mode);
    tickTetrisGame(game, 400);
    assert.equal(moveTetrisPlayer(game, 1, "left"), true);
    assert.equal(piece(game).lockElapsed, 0);
    tickTetrisGame(game, 400);
    assert.equal(moveTetrisPlayer(game, 1, "rotate_ccw"), true);
    assert.equal(piece(game).lockElapsed, 0);
    assert.equal(piece(game).lockResets, 2);
    // Put the piece against the wall and try an impossible move.
    piece(game).x = 0;
    tickTetrisGame(game, 400);
    assert.equal(moveTetrisPlayer(game, 1, "left"), false);
    assert.equal(piece(game).lockElapsed, 400);
    tickTetrisGame(game, 100);
    assert.equal(board(game).flat().filter(Boolean).length, 4);
  });

  test(`${mode}: hold consumes the preview once and swaps only after locking`, () => {
    const game = groundedGame(mode);
    const next = game.state.next[1];
    const other = { ...piece(game, 2) };
    assert.equal(moveTetrisPlayer(game, 1, "hold"), true);
    assert.equal(game.state.hold[1], "O");
    assert.equal(piece(game).type, next);
    assert.equal(piece(game).rotation, 0);
    assert.equal(piece(game).lockElapsed, 0);
    assert.equal(game.state.holdUsed[1], true);
    assert.deepEqual(piece(game, 2), other);
    const afterHold = structuredClone(game.state);
    assert.equal(moveTetrisPlayer(game, 1, "hold"), false);
    assert.deepEqual(game.state, afterHold);
    moveTetrisPlayer(game, 1, "drop");
    assert.equal(game.state.holdUsed[1], false);
    const beforeSwap = piece(game).type;
    const preview = game.state.next[1];
    assert.equal(moveTetrisPlayer(game, 1, "hold"), true);
    assert.equal(piece(game).type, "O");
    assert.equal(game.state.hold[1], beforeSwap);
    assert.equal(game.state.next[1], preview);
  });
}

test("grounded movement cannot reset the lock timer more than 15 times", () => {
  const game = groundedGame();
  for (let index = 0; index < 15; index += 1) {
    tickTetrisGame(game, 100);
    moveTetrisPlayer(game, 1, index % 2 ? "right" : "left");
    assert.equal(piece(game).lockElapsed, 0);
  }
  tickTetrisGame(game, 400);
  moveTetrisPlayer(game, 1, "right");
  assert.equal(piece(game).lockResets, 15);
  assert.equal(piece(game).lockElapsed, 400);
  tickTetrisGame(game, 100);
  assert.equal(board(game).flat().filter(Boolean).length, 4);
});

test("a piece leaving a ledge gets a fresh delay when it lands again", () => {
  const game = groundedGame();
  piece(game).y = 16;
  board(game)[18][3] = { type: "G", owner: 1 };
  tickTetrisGame(game, 400);
  moveTetrisPlayer(game, 1, "right");
  moveTetrisPlayer(game, 1, "right");
  assert.equal(piece(game).lockElapsed, 0);
  moveTetrisPlayer(game, 1, "down");
  moveTetrisPlayer(game, 1, "down");
  assert.equal(piece(game).y, 18);
  tickTetrisGame(game, 499);
  assert.equal(board(game).flat().filter(Boolean).length, 1);
  tickTetrisGame(game, 1);
  assert.equal(board(game).flat().filter(Boolean).length, 5);
});

test("hard drop locks immediately and pause freezes the remaining delay", () => {
  const game = groundedGame();
  tickTetrisGame(game, 400);
  commandTetrisGame(game, "toggle_pause");
  assert.equal(tickTetrisGame(game, 10000), false);
  assert.equal(piece(game).lockElapsed, 400);
  commandTetrisGame(game, "toggle_pause");
  moveTetrisPlayer(game, 1, "drop");
  assert.equal(board(game).flat().filter(Boolean).length, 4);
});

test("clockwise and counterclockwise rotations are inverses and retain wall kicks", () => {
  const game = createTetrisGame("duel");
  game.state.active[0] = { type: "T", player: 1, rotation: 0, x: 3, y: 4 };
  const before = { ...piece(game) };
  moveTetrisPlayer(game, 1, "rotate");
  assert.equal(piece(game).rotation, 1);
  moveTetrisPlayer(game, 1, "rotate_ccw");
  assert.equal(piece(game).rotation, before.rotation);
  assert.equal(piece(game).x, before.x);
  game.state.active[0] = { type: "I", player: 1, rotation: 1, x: -2, y: 4 };
  assert.equal(moveTetrisPlayer(game, 1, "rotate_ccw"), true);
  assert.equal(piece(game).rotation, 0);
  assert.equal(piece(game).x, 0);
});

test("hold tops out when its spawn is blocked and restart clears both reserves", () => {
  const game = groundedGame();
  game.state.hold[1] = "O";
  board(game)[0][4] = { type: "G", owner: 1 };
  moveTetrisPlayer(game, 1, "hold");
  assert.equal(game.state.status, "gameover");
  assert.equal(game.state.winner, 2);
  commandTetrisGame(game, "restart");
  assert.deepEqual(game.state.hold, { 1: null, 2: null });
  assert.deepEqual(game.state.holdUsed, { 1: false, 2: false });
});

test("gravity falls on its own schedule and starts a full delay at contact", () => {
  const game = groundedGame();
  piece(game).y = 17;
  tickTetrisGame(game, 819);
  assert.equal(piece(game).y, 17);
  tickTetrisGame(game, 1);
  assert.equal(piece(game).y, 18);
  assert.equal(piece(game).lockElapsed, 0);
  tickTetrisGame(game, 499);
  assert.equal(board(game).flat().filter(Boolean).length, 0);
  tickTetrisGame(game, 1);
  assert.equal(board(game).flat().filter(Boolean).length, 4);
});
