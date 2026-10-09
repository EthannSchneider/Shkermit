import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(file, dependencies = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  let linked = outputText;
  for (const [name, url] of Object.entries(dependencies)) linked = linked.replaceAll(`'${name}'`, JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(linked).toString('base64')}`;
}
const constantsUrl = await moduleUrl('../src/components/games/tetris/constants.ts');
const logicUrl = await moduleUrl('../src/components/games/tetris/game-logic.ts', { './constants': constantsUrl });
const storageUrl = await moduleUrl('../src/components/games/tetris/storage.ts', { './constants': constantsUrl, './game-logic': logicUrl });
const rulesUrl = await moduleUrl('../src/components/games/tetris/tetris-rules.ts');
const { detectTSpin, getRotationCandidates, scoreClear } = await import(rulesUrl);
const serverRules = await import('../../backend/src/services/tetris-rules.js');
const { LOCK_DELAY, DEFAULT_BINDINGS } = await import(constantsUrl);
const { advanceLock, holdPiece, isGrounded, updateLockAfterMove, spawnPiece, isValid, makeBoard } = await import(logicUrl);
const { initialGame, getSavedBindings } = await import(storageUrl);

function solo() {
  const game = initialGame();
  game.status = 'playing';
  game.active = [{ ...spawnPiece('O', 1, 10, 'solo'), x: 3, y: 18 }];
  return game;
}

test('solo gives 500 ms on contact and restarts the delay after a grounded move', () => {
  const game = solo();
  let piece = advanceLock(game.active[0], game, 499);
  assert.equal(piece.lockElapsed < LOCK_DELAY, true);
  piece = updateLockAfterMove(piece, { ...piece, x: piece.x + 1 }, game);
  assert.equal(piece.lockElapsed, 0);
  assert.equal(piece.lockResets, 1);
  piece = advanceLock(piece, game, 499);
  assert.equal(piece.lockElapsed < LOCK_DELAY, true);
  piece = advanceLock(piece, game, 1);
  assert.equal(piece.lockElapsed >= LOCK_DELAY, true);
});

test('solo resets the delay for grounded rotations and limits resets to 15', () => {
  const game = solo();
  const piece = { ...game.active[0], lockElapsed: 400 };
  const rotated = { ...piece, rotation: 3 };
  const reset = updateLockAfterMove(piece, rotated, game);
  assert.equal(reset.lockElapsed, 0);
  const exhausted = { ...piece, lockResets: 15 };
  const limited = updateLockAfterMove(exhausted, { ...exhausted, x: 4 }, game);
  assert.equal(limited.lockElapsed, 400);
  assert.equal(advanceLock(limited, game, 100).lockElapsed, LOCK_DELAY);
});

test('a piece in the air does not accumulate ground time', () => {
  const game = solo();
  const airborne = { ...game.active[0], y: 10, lockElapsed: 400 };
  assert.equal(isGrounded(airborne, game), false);
  assert.equal(advanceLock(airborne, game, 500).lockElapsed, 0);
});

test('solo hold takes the preview once, then swaps without drawing another piece', () => {
  const game = solo();
  game.active[0].rotation = 3;
  let draws = 0;
  const draw = () => { draws += 1; return 'I'; };
  const held = holdPiece(game, 1, draw);
  assert.equal(draws, 1);
  assert.equal(held.hold[1], 'O');
  assert.equal(held.active[0].type, game.next[1]);
  assert.equal(held.active[0].rotation, 0);
  assert.equal(held.active[0].y, 0);
  assert.equal(held.active[0].lockElapsed, 0);
  assert.equal(holdPiece(held, 1, draw), null);
  assert.equal(draws, 1);
  const swap = holdPiece({ ...held, holdUsed: { 1: false, 2: false } }, 1, draw);
  assert.equal(draws, 1);
  assert.equal(swap.active[0].type, 'O');
  assert.equal(swap.hold[1], held.active[0].type);
  assert.deepEqual(swap.next, held.next);
});

test('held piece respawns at the top and its collision can end the game', () => {
  const game = solo();
  game.hold[1] = 'O';
  game.board[0][4] = { type: 'G', owner: 1 };
  const held = holdPiece(game, 1, () => 'T');
  assert.equal(isValid(held.active[0], held.board, held.active, held.cols), false);
});

test('new keyboard actions preserve saved custom keys even when C and Q are already used', () => {
  const saved = { ...DEFAULT_BINDINGS, left: { code: 'KeyC', label: 'C' }, right: { code: 'KeyQ', label: 'Q' } };
  delete saved.hold;
  delete saved.rotate_ccw;
  globalThis.window = { localStorage: { getItem: () => JSON.stringify(saved) } };
  try {
    const restored = getSavedBindings();
    assert.deepEqual(restored.left, saved.left);
    assert.deepEqual(restored.right, saved.right);
    assert.equal(new Set(Object.values(restored).map((binding) => binding.code)).size, Object.keys(DEFAULT_BINDINGS).length);
    assert.ok(restored.hold.code);
    assert.ok(restored.rotate_ccw.code);
  } finally {
    delete globalThis.window;
  }
});

test('T-spin detection distinguishes front corners in every orientation', () => {
  const frontCorners = [[0, 1], [1, 3], [2, 3], [0, 2]];
  const corners = [[3, 5], [5, 5], [3, 7], [5, 7]];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const piece = { ...spawnPiece('T', 1, 10, 'solo'), x: 3, y: 5, rotation, lastRotationKick: 0 };
    const [frontA, frontB] = frontCorners[rotation];
    const back = [0, 1, 2, 3].filter((index) => index !== frontA && index !== frontB);
    for (const [filled, expected] of [
      [[frontA, frontB, back[0]], 'full'], [[frontA, ...back], 'mini'], [[frontA, frontB], null],
    ]) {
      const board = makeBoard(10);
      for (const index of filled) {
        const [x, y] = corners[index];
        board[y][x] = { type: 'G', owner: 1 };
      }
      assert.equal(detectTSpin(piece, board), expected);
      assert.equal(serverRules.detectTSpin(piece, board), expected);
      assert.equal(detectTSpin({ ...piece, lastRotationKick: undefined }, board), null);
      assert.equal(detectTSpin({ ...piece, type: 'J' }, board), null);
      if (expected === 'mini') assert.equal(detectTSpin({ ...piece, lastRotationKick: 4 }, board), 'full');
    }
  }
});

test('walls and the floor count as corners, while empty space above the board does not', () => {
  const board = makeBoard(10);
  board[18][3] = { type: 'G', owner: 1 };
  const piece = { ...spawnPiece('T', 1, 10, 'solo'), x: 3, y: 18, rotation: 0, lastRotationKick: 0 };
  assert.equal(detectTSpin(piece, board), 'mini');
  board[18][5] = { type: 'G', owner: 1 };
  assert.equal(detectTSpin(piece, board), 'full');
  board[7][1] = { type: 'G', owner: 1 };
  assert.equal(detectTSpin({ ...piece, x: -1, y: 5, rotation: 3 }, board), 'full');
  assert.equal(detectTSpin({ ...piece, y: -1 }, board), null);
});

test('SRS floor kicks and rotation metadata survive lock resets in solo', () => {
  for (const clockwise of [true, false]) {
    const game = solo();
    const piece = { ...spawnPiece('T', 1, 10, 'solo'), x: 3, y: 18, lockElapsed: 400 };
    game.active = [piece];
    const rotated = getRotationCandidates(piece, clockwise)
      .find((candidate) => isValid(candidate, game.board, game.active, game.cols));
    assert.equal(rotated.y, 17);
    assert.equal(rotated.lastRotationKick, 2);
    const adjusted = updateLockAfterMove(piece, rotated, game);
    assert.equal(adjusted.lastRotationKick, 2);
    assert.equal(adjusted.lockElapsed, 0);
    assert.equal(adjusted.lockResets, 1);
    assert.equal(advanceLock(adjusted, game, 100).lastRotationKick, 2);
    assert.equal(updateLockAfterMove(adjusted, { ...adjusted, x: adjusted.x + 1 }, game).lastRotationKick, undefined);
    assert.equal(updateLockAfterMove(adjusted, { ...adjusted, y: adjusted.y + 1 }, game).lastRotationKick, undefined);
    const held = holdPiece({ ...game, active: [adjusted] }, 1, () => 'I');
    assert.equal(held.active[0].lastRotationKick, undefined);
  }
});

test('solo T-spin triples rotate into a slot using the fifth SRS test', () => {
  const game = solo();
  const piece = { ...spawnPiece('T', 1, 10, 'solo'), x: 4, y: 15 };
  game.active = [piece];
  for (const [y, holes] of [[17, [4]], [18, [4, 5]], [19, [4]]]) {
    game.board[y] = Array.from({ length: 10 }, (_, x) => holes.includes(x) ? null : { type: 'G', owner: 1 });
  }
  game.board[15][4] = { type: 'G', owner: 1 };
  const rotated = getRotationCandidates(piece, true)
    .find((candidate) => isValid(candidate, game.board, game.active, game.cols));
  assert.equal(rotated.lastRotationKick, 4);
  assert.equal(rotated.x, 3);
  assert.equal(rotated.y, 17);
  assert.equal(isGrounded(rotated, game), true);
  assert.equal(detectTSpin(rotated, game.board), 'full');
});

test('T-spins award full and mini bonuses with level scaling, combos, and garbage', () => {
  for (const [spin, values] of [['full', [[400, 0], [800, 2], [1200, 4], [1600, 6]]], ['mini', [[100, 0], [200, 0], [400, 1]]]]) {
    values.forEach(([points, attackRows], lines) => {
      const result = scoreClear(spin, lines, 1, -1);
      assert.equal(result.gained, points);
      assert.equal(result.attackRows, attackRows);
      assert.equal(result.backToBack, lines > 0);
      assert.match(result.label, /T-SPIN/);
      assert.deepEqual(result, serverRules.scoreClear(spin, lines, 1, -1));
    });
  }
  const chained = scoreClear('full', 2, 2, 0, true);
  assert.equal(chained.gained, 3700);
  assert.equal(chained.attackRows, 5);
  assert.match(chained.label, /BACK-TO-BACK.*T-SPIN DOUBLE.*2x combo/);
});

test('back-to-back chains survive zero-line locks and break on ordinary clears', () => {
  assert.equal(scoreClear(null, 0, 1, 2, true).backToBack, true);
  assert.equal(scoreClear('mini', 0, 1, 2, true).backToBack, true);
  assert.equal(scoreClear('full', 0, 1, 2, true).gained, 400);
  assert.equal(scoreClear('full', 0, 1, 2, true).attackRows, 0);
  for (const [lines, points, attacks] of [[1, 100, 0], [2, 300, 1], [3, 500, 2]]) {
    const result = scoreClear(null, lines, 1, -1, true);
    assert.equal(result.backToBack, false);
    assert.equal(result.gained, points);
    assert.equal(result.attackRows, attacks);
  }
  assert.equal(scoreClear(null, 4, 1, -1, true).gained, 1200);
});

test('browser and server produce identical SRS candidates for every piece and turn', () => {
  for (const type of ['I', 'O', 'T', 'S', 'Z', 'J', 'L']) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      for (const clockwise of [true, false]) {
        const piece = { ...spawnPiece(type, 1, 10, 'solo'), rotation };
        assert.deepEqual(getRotationCandidates(piece, clockwise), serverRules.getRotationCandidates(piece, clockwise));
      }
    }
  }
});
