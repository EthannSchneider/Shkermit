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
const { LOCK_DELAY, DEFAULT_BINDINGS } = await import(constantsUrl);
const { advanceLock, holdPiece, isGrounded, updateLockAfterMove, spawnPiece, isValid } = await import(logicUrl);
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
