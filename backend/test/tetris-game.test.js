import assert from "node:assert/strict";
import test from "node:test";
import { commandTetrisGame, createTetrisGame, getTetrisDropDelay, moveTetrisPlayer, tickTetrisGame } from "../src/services/tetris-game.service.js";

function groundedGame(mode = "duel") {
  const game = createTetrisGame(mode);
  game.state.active[0] = { type: "O", player: 1, rotation: 0, x: 3, y: 18, lockElapsed: 0, lockResets: 0 };
  return game;
}

const piece = (game, player = 1) => game.state.active.find((item) => item.player === player);
const board = (game, player = 1) => game.state.mode === "duel" ? game.state.duelBoards[player] : game.state.board;

function spinSetup(mode, lines = 2, mini = false, player = 1) {
  const game = createTetrisGame(mode);
  game.state.active = [
    { type: "T", player, rotation: 1, x: 3, y: 17, lockElapsed: 0, lockResets: 0 },
    { type: "O", player: player === 1 ? 2 : 1, rotation: 0, x: 8, y: 0 },
  ];
  const stack = board(game, player);
  const fill = (x, y) => { stack[y][x] = { type: "G", owner: player }; };
  fill(3, 17);
  fill(3, 19);
  fill(5, mini ? 17 : 19);
  if (lines > 0) {
    for (let x = 0; x < game.state.cols; x += 1) if (![3, 4, 5].includes(x)) fill(x, 18);
  }
  if (lines === 2) {
    for (let x = 0; x < game.state.cols; x += 1) if (x !== 4) fill(x, 19);
  }
  return game;
}

for (const mode of ["coop", "duel"]) {
  for (const [lines, points, attack] of [[0, 400, 0], [1, 800, 2], [2, 1200, 4]]) {
    test(`${mode}: a rotated T-spin clearing ${lines} lines awards ${points} points`, () => {
      const game = spinSetup(mode, lines);
      assert.equal(moveTetrisPlayer(game, 1, "rotate"), true);
      assert.equal(piece(game).lastRotationKick, 0);
      // A blocked soft drop and zero-distance hard drop preserve the rotation.
      assert.equal(moveTetrisPlayer(game, 1, "down"), false);
      moveTetrisPlayer(game, 1, "drop");
      assert.equal(game.state.score, points);
      assert.equal(game.state.playerStats[1].score, points);
      assert.equal(game.state.lines, lines);
      assert.match(game.state.message, /T-SPIN/);
      assert.equal(piece(game).lastRotationKick, undefined);
      if (mode === "duel") {
        const garbage = board(game, 2).filter((row) => row.some((cell) => cell?.type === "G"));
        assert.equal(garbage.length, attack);
      }
    });
  }

  test(`${mode}: mini spins get a smaller bonus and can lock on the timer`, () => {
    const game = spinSetup(mode, 1, true);
    moveTetrisPlayer(game, 1, "rotate");
    tickTetrisGame(game, 500);
    assert.equal(game.state.score, 200);
    assert.equal(game.state.lines, 1);
    assert.match(game.state.message, /T-SPIN MINI SINGLE/);
    if (mode === "duel") assert.equal(board(game, 2).flat().filter(Boolean).length, 0);
  });

  test(`${mode}: a T dropped into the same slot without rotating is an ordinary double`, () => {
    const game = spinSetup(mode);
    piece(game).rotation = 2;
    moveTetrisPlayer(game, 1, "drop");
    assert.equal(game.state.score, 300);
    assert.doesNotMatch(game.state.message, /T-SPIN/);
  });

  test(`${mode}: the fifth SRS kick allows a T-spin triple`, () => {
    const game = createTetrisGame(mode);
    game.state.active[0] = { type: "T", player: 1, rotation: 0, x: 4, y: 15 };
    const stack = board(game);
    for (const [y, holes] of [[17, [4]], [18, [4, 5]], [19, [4]]]) {
      stack[y] = Array.from({ length: game.state.cols }, (_, x) => (
        holes.includes(x) ? null : { type: "G", owner: 1 }
      ));
    }
    stack[15][4] = { type: "G", owner: 1 };
    assert.equal(moveTetrisPlayer(game, 1, "rotate"), true);
    assert.equal(piece(game).lastRotationKick, 4);
    assert.equal(piece(game).x, 3);
    assert.equal(piece(game).y, 17);
    moveTetrisPlayer(game, 1, "drop");
    assert.equal(game.state.lines, 3);
    assert.equal(game.state.score, 1600);
    assert.match(game.state.message, /T-SPIN TRIPLE/);
    if (mode === "duel") assert.equal(board(game, 2).filter((row) => row.some(Boolean)).length, 6);
  });
}

test("duel T-spins use Player 2's board and back-to-back chain independently", () => {
  const game = spinSetup("duel", 2, false, 2);
  game.state.playerStats[2].backToBack = true;
  game.state.playerStats[2].combo = 0;
  game.state.level = 2;
  moveTetrisPlayer(game, 2, "rotate");
  moveTetrisPlayer(game, 2, "drop");
  assert.equal(game.state.playerStats[2].score, 3700);
  assert.equal(game.state.playerStats[1].score, 0);
  assert.equal(game.state.playerStats[1].backToBack, false);
  assert.equal(board(game, 1).filter((row) => row.some(Boolean)).length, 5);
  assert.match(game.state.message, /BACK-TO-BACK.*T-SPIN DOUBLE/);
});

test("successful translations clear spin credit, while failed rotations preserve it", () => {
  const game = spinSetup("duel");
  moveTetrisPlayer(game, 1, "rotate");
  // Surround the T so all clockwise kick tests fail.
  board(game)[17][4] = { type: "G", owner: 1 };
  board(game)[16][3] = { type: "G", owner: 1 };
  board(game)[16][4] = { type: "G", owner: 1 };
  assert.equal(moveTetrisPlayer(game, 1, "rotate"), false);
  assert.equal(piece(game).lastRotationKick, 0);
  game.state.duelBoards[1] = Array.from({ length: 20 }, () => Array(10).fill(null));
  moveTetrisPlayer(game, 1, "left");
  assert.equal(piece(game).lastRotationKick, undefined);
  piece(game).y = 14;
  moveTetrisPlayer(game, 1, "rotate");
  assert.equal(moveTetrisPlayer(game, 1, "down"), true);
  assert.equal(piece(game).lastRotationKick, undefined);
});

test("a hard drop that travels cannot claim a previous rotation as a T-spin", () => {
  const game = spinSetup("duel", 0);
  piece(game).y = 14;
  piece(game).lastRotationKick = 0;
  moveTetrisPlayer(game, 1, "drop");
  assert.equal(game.state.score, 6);
  assert.doesNotMatch(game.state.message, /T-SPIN/);
});

test("SRS floor kicks work in both directions and use a separate I-piece table", () => {
  for (const [type, action, rotation, y, kick] of [
    ["T", "rotate", 1, 17, 2], ["T", "rotate_ccw", 3, 17, 2], ["I", "rotate", 1, 16, 4],
  ]) {
    const game = createTetrisGame("duel");
    game.state.active[0] = { type, player: 1, rotation: 0, x: 3, y: 18 };
    assert.equal(moveTetrisPlayer(game, 1, action), true);
    assert.equal(piece(game).rotation, rotation);
    assert.equal(piece(game).y, y);
    assert.equal(piece(game).lastRotationKick, kick);
  }
});

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

test("gravity speeds up every level until instant falling at level 32", () => {
  const game = createTetrisGame("duel");
  assert.equal(getTetrisDropDelay(game), 820);
  let previousDelay = 820;
  for (let level = 2; level <= 32; level += 1) {
    game.state.level = level;
    const delay = getTetrisDropDelay(game);
    assert.ok(delay < previousDelay);
    previousDelay = delay;
  }
  assert.equal(previousDelay, 0);
  game.state.level = 100;
  assert.equal(getTetrisDropDelay(game), 0);
});

for (const mode of ["coop", "duel"]) {
  const airborneGame = (level) => {
    const game = createTetrisGame(mode);
    game.state.level = level;
    game.state.active = [1, 2].map((player) => ({
      type: "O", player, rotation: 0, x: player === 1 ? 2 : 8, y: 0,
      lockElapsed: 0, lockResets: 0,
    }));
    return game;
  };

  test(`${mode}: fast gravity catches up multiple rows and retains elapsed time`, () => {
    const game = airborneGame(31);
    tickTetrisGame(game, 60);
    assert.equal(piece(game, 1).y, 2);
    assert.equal(piece(game, 2).y, 2);
    tickTetrisGame(game, 20);
    assert.equal(piece(game, 1).y, 3);
    assert.equal(piece(game, 2).y, 3);
  });

  test(`${mode}: zero-delay gravity lands immediately and preserves the lock delay`, () => {
    const game = airborneGame(32);
    tickTetrisGame(game, 25);
    assert.equal(piece(game, 1).y, 18);
    assert.equal(piece(game, 2).y, 18);
    assert.equal(piece(game, 1).lockElapsed, 0);
    assert.equal(game.gravityElapsed, 0);
    assert.equal(board(game).flat().filter(Boolean).length, 0);
    assert.equal(moveTetrisPlayer(game, 1, "left"), true);
    tickTetrisGame(game, 499);
    assert.equal(board(game).flat().filter(Boolean).length, 0);
    tickTetrisGame(game, 1);
    assert.equal(board(game).flat().filter(Boolean).length, mode === "coop" ? 8 : 4);
    assert.equal(Number.isFinite(game.gravityElapsed), true);
  });
}
