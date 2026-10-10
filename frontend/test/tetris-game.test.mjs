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
const autoSettingsUrl = await moduleUrl('../src/components/games/tetris/auto-settings.ts');
const { DEFAULT_AUTO_SETTINGS, AUTO_SETTINGS_STORAGE_KEY, getSavedAutoSettings, getAutoActionInterval, normalizeAutoSettings } = await import(autoSettingsUrl);
const autoUrl = await moduleUrl('../src/components/games/tetris/auto-player.ts', {
  './constants': constantsUrl, './game-logic': logicUrl, './tetris-rules': rulesUrl,
  './auto-settings': autoSettingsUrl,
});
const { planAutoPlay, shouldAutoFlush } = await import(autoUrl);
const { detectTSpin, getRotationCandidates, scoreClear } = await import(rulesUrl);
const serverRules = await import('../../backend/src/services/tetris-rules.js');
const { LOCK_DELAY, DEFAULT_BINDINGS } = await import(constantsUrl);
const { advanceLock, getCells, getGhost, holdPiece, isGrounded, updateLockAfterMove, spawnPiece, isValid, makeBoard, getPlayerBoard, getCollidingPieces, getBoardRows, growGameBoard } = await import(logicUrl);
const { initialGame, getSavedBindings, isGameState } = await import(storageUrl);
const { getTetrisBoardRows } = await import('../../backend/src/services/tetris-game.service.js');

test('board growth adds whole rows starting at level 32 and agrees with the server', () => {
  for (const [level, rows] of [[1, 20], [31, 20], [32, 21], [33, 22], [34, 22], [36, 23], [100, 62]]) {
    assert.equal(getBoardRows(level), rows);
    assert.equal(getTetrisBoardRows(level), rows);
  }
});

for (const mode of ['solo', 'coop', 'duel']) {
  test(`${mode}: growth preserves the stack and active pieces relative to the floor`, () => {
    const game = initialGame(mode);
    game.status = 'playing';
    game.level = 36;
    game.active = [{ ...spawnPiece('O', 1, game.cols, mode), y: 18 }];
    getPlayerBoard(game, 1)[19][0] = { type: 'G', owner: 1 };
    const before = structuredClone(game);
    const grown = growGameBoard(game);
    assert.deepEqual(game, before);
    assert.equal(grown.board.length, 23);
    assert.equal(getPlayerBoard(grown, 1)[22][0].type, 'G');
    assert.equal(grown.active[0].y, 21);
    assert.equal(isGrounded(grown.active[0], grown), true);
    assert.equal(getPlayerBoard(grown, 1).slice(0, 3).flat().some(Boolean), false);
    assert.ok(getPlayerBoard(grown, 1).every((row) => row.length === game.cols));
    assert.equal(growGameBoard(grown), grown);
    const airborne = spawnPiece('O', 1, game.cols, mode);
    assert.equal(getGhost(airborne, getPlayerBoard(grown, 1), [], game.cols).y, 21);
    assert.equal(isValid({ ...airborne, y: 22 }, getPlayerBoard(grown, 1), [], game.cols), false);
    if (mode !== 'solo') {
      assert.equal(isGameState(grown), true);
      assert.equal(isGameState({ ...grown, board: grown.board.slice(1) }), false);
    }
  });
}

test('autopilot clears rows below the original floor and flush uses the expanded height', () => {
  const game = growGameBoard({ ...initialGame(), level: 36, status: 'playing' });
  game.active = [{ ...spawnPiece('I', 1, game.cols, 'solo'), rotation: 1, x: -2 }];
  game.next[1] = 'O';
  for (let y = 19; y < 23; y += 1) {
    game.board[y] = Array.from({ length: game.cols }, (_, x) => x === 0 ? null : { type: 'G', owner: 1 });
  }
  const plan = planAutoPlay(game, 1);
  assert.ok(plan);
  for (const action of plan) executeAutoAction(game, 1, action);
  for (const { x, y } of getCells(game.active[0])) game.board[y][x] = { type: 'I', owner: 1 };
  assert.equal(game.board.filter((row) => row.every(Boolean)).length, 4);
  game.board = game.board.map((row) => row.map(() => null));
  game.meter = 100;
  const settings = { ...DEFAULT_AUTO_SETTINGS, autoFlush: true };
  game.board[14][0] = { type: 'G', owner: 1 };
  assert.equal(shouldAutoFlush(game, settings), false);
  game.board[13][0] = { type: 'G', owner: 1 };
  assert.equal(shouldAutoFlush(game, settings), true);
});

function solo() {
  const game = initialGame();
  game.status = 'playing';
  game.active = [{ ...spawnPiece('O', 1, 10, 'solo'), x: 3, y: 18 }];
  return game;
}

function executeAutoAction(game, player, action) {
  const previous = game.active.find((piece) => piece.player === player);
  const board = getPlayerBoard(game, player);
  const active = getCollidingPieces(game, player);
  let moved;
  if (action === 'drop') moved = getGhost(previous, board, active, game.cols);
  else if (action === 'rotate' || action === 'rotate_ccw') {
    moved = getRotationCandidates(previous, action === 'rotate').find((candidate) => isValid(candidate, board, active, game.cols));
  } else moved = { ...previous, x: previous.x + (action === 'left' ? -1 : action === 'right' ? 1 : 0), y: previous.y + (action === 'down' ? 1 : 0) };
  assert.ok(moved, `Auto action ${action} must have a legal rotation`);
  assert.equal(isValid(moved, board, active, game.cols), true, `Auto action ${action} must be legal`);
  game.active = game.active.map((piece) => piece.player === player ? moved : piece);
  return moved;
}

test('auto rotates an I into a four-line gap using legal moves without modifying the input', () => {
  const game = initialGame();
  game.status = 'playing';
  game.active = [spawnPiece('I', 1, 10, 'solo')];
  for (let y = 16; y < 20; y += 1) game.board[y] = Array.from({ length: 10 }, (_, x) => x === 0 ? null : { type: 'G', owner: 1 });
  const before = structuredClone(game);
  const plan = planAutoPlay(game, 1);
  assert.deepEqual(game, before);
  assert.equal(plan.at(-1), 'drop');
  assert.ok(plan.includes('rotate') || plan.includes('rotate_ccw'));
  for (const action of plan) executeAutoAction(game, 1, action);
  for (const { x, y } of getCells(game.active[0])) game.board[y][x] = { type: 'I', owner: 1 };
  assert.equal(game.board.filter((row) => row.every(Boolean)).length, 4);
});

test('auto only plans for a playing game with a safe active piece', () => {
  const game = solo();
  for (const status of ['ready', 'paused', 'gameover']) assert.equal(planAutoPlay({ ...game, status }, 1), null);
  assert.equal(planAutoPlay(game, 2), null);
  game.active = [spawnPiece('T', 1, 10, 'solo')];
  game.board = Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => ({ type: 'G', owner: 1 })));
  assert.equal(planAutoPlay(game, 1), null);
});

test('auto respects the partner piece in co-op and uses player two’s own board in a duel', () => {
  for (const mode of ['coop', 'duel']) {
    const game = initialGame(mode);
    game.status = 'playing';
    game.active = [spawnPiece('T', 1, game.cols, mode), spawnPiece('I', 2, game.cols, mode)];
    const originalPlayerOne = structuredClone(game.active[0]);
    const board = getPlayerBoard(game, 2);
    for (let y = 16; y < 20; y += 1) board[y] = Array.from({ length: game.cols }, (_, x) => x === game.cols - 1 ? null : { type: 'G', owner: 1 });
    if (mode === 'duel') game.duelBoards[1] = Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => ({ type: 'G', owner: 1 })));
    const plan = planAutoPlay(game, 2);
    assert.ok(plan);
    for (const action of plan) executeAutoAction(game, 2, action);
    assert.deepEqual(game.active[0], originalPlayerOne);
    const cells = getCells(game.active[1]);
    assert.equal(cells.every(({ x, y }) => x === game.cols - 1 && y >= 16), true);
  }
});

test('auto continuously replans after movement and gravity and clears a sequence of pieces', () => {
  const game = initialGame();
  game.status = 'playing';
  const types = ['T', 'Z', 'I', 'L', 'O', 'J', 'S', 'O', 'L', 'S', 'T', 'I', 'Z', 'J'];
  let lines = 0;
  for (let index = 0; index < 70; index += 1) {
    game.active = [spawnPiece(types[index % types.length], 1, 10, 'solo')];
    game.next[1] = types[(index + 1) % types.length];
    let landed = false;
    for (let step = 0; step < 60; step += 1) {
      const plan = planAutoPlay(game, 1);
      assert.ok(plan, `Piece ${index} must have a safe plan`);
      const action = plan[0];
      const moved = executeAutoAction(game, 1, action);
      if (action === 'drop') {
        for (const { x, y } of getCells(moved)) {
          assert.ok(y >= 0, `Piece ${index} must fit below the ceiling`);
          game.board[y][x] = { type: moved.type, owner: 1 };
        }
        const remaining = game.board.filter((row) => !row.every(Boolean));
        lines += 20 - remaining.length;
        while (remaining.length < 20) remaining.unshift(Array(10).fill(null));
        game.board = remaining;
        landed = true;
        break;
      }
      if (step % 3 === 2 && isValid({ ...moved, y: moved.y + 1 }, game.board, game.active, 10)) executeAutoAction(game, 1, 'down');
    }
    assert.equal(landed, true, `Piece ${index} must drop without looping`);
  }
  assert.ok(lines >= 20, `Expected at least 20 lines; cleared ${lines}`);
});

test('auto reaches a hard drop without rotation cycles under instant gravity from level 32', () => {
  // This stack made the S piece alternate clockwise/counterclockwise forever at level 33.
  const rows = [
    '###.#..##.', '###.#.####', '##.....###', '##.#####.#',
    '#####.#.#.', '.####.#.##', '###.#....#', '###..##.#.',
  ];
  for (const mode of ['solo', 'coop', 'duel']) {
    for (const level of [32, 33, 60]) {
      for (const playStyle of ['balanced', 'safe', 'aggressive']) {
        for (const lookAhead of [true, false]) {
          const game = initialGame(mode);
          const player = mode === 'solo' ? 1 : 2;
          game.status = 'playing';
          game.level = level;
          const board = getPlayerBoard(game, player);
          for (let index = 0; index < rows.length; index += 1) {
            board[12 + index] = Array.from({ length: game.cols }, (_, x) => (
              rows[index][x] === '#' ? { type: 'G', owner: 1 } : null
            ));
          }
          game.next[player] = 'Z';
          const piece = { ...spawnPiece('S', player, game.cols, mode), x: 4 };
          game.active = [getGhost(piece, board, [], game.cols)];
          if (mode !== 'solo') game.active.push(spawnPiece('O', 1, game.cols, mode));
          const partner = structuredClone(game.active.find((active) => active.player !== player));
          const seen = new Set();
          let dropped = false;
          const context = `${mode}, level ${level}, ${playStyle}, lookAhead=${lookAhead}`;
          for (let step = 0; step < 40; step += 1) {
            const active = game.active.find((item) => item.player === player);
            const key = `${active.x}:${active.y}:${active.rotation}`;
            assert.equal(seen.has(key), false, `Autopilot must not repeat a position: ${context}`);
            seen.add(key);
            const plan = planAutoPlay(game, player, { ...DEFAULT_AUTO_SETTINGS, playStyle, lookAhead });
            assert.ok(plan?.length, `Autopilot must find a legal placement: ${context}`);
            const moved = executeAutoAction(game, player, plan[0]);
            if (plan[0] === 'drop') {
              dropped = true;
              assert.ok(getCells(moved).every(({ y }) => y >= 0));
              break;
            }
            // The engine settles the piece between successive autopilot actions at these levels.
            const settled = getGhost(moved, board, getCollidingPieces(game, player), game.cols);
            game.active = game.active.map((item) => item.player === player ? settled : item);
          }
          assert.equal(dropped, true, `Autopilot must finish without toggling off/on: ${context}`);
          assert.deepEqual(game.active.find((active) => active.player !== player), partner);
        }
      }
    }
  }
});

test('autopilot speed changes action timing and respects the online limit', () => {
  const fast = { ...DEFAULT_AUTO_SETTINGS, actionsPerSecond: 20 };
  const slow = { ...DEFAULT_AUTO_SETTINGS, actionsPerSecond: 1 };
  assert.equal(getAutoActionInterval(fast, 'solo'), 50);
  assert.equal(getAutoActionInterval(slow, 'solo'), 1000);
  for (const mode of ['coop', 'duel']) {
    assert.equal(getAutoActionInterval(fast, mode), 100);
    assert.equal(getAutoActionInterval(slow, mode), 1000);
  }
  assert.equal(getAutoActionInterval({ ...fast, actionsPerSecond: 0 }, 'solo'), 1000);
  assert.equal(getAutoActionInterval({ ...fast, actionsPerSecond: Infinity }, 'solo'), 125);
});

test('autopilot preferences restore safely from device storage without enabling autopilot', () => {
  const saved = { actionsPerSecond: 17, playStyle: 'safe', lookAhead: false, autoFlush: true, enabled: true };
  let value = JSON.stringify(saved);
  globalThis.window = { localStorage: { getItem: (key) => { assert.equal(key, AUTO_SETTINGS_STORAGE_KEY); return value; } } };
  try {
    assert.deepEqual(getSavedAutoSettings(), { actionsPerSecond: 17, playStyle: 'safe', lookAhead: false, autoFlush: true });
    for (const corrupt of ['invalid json', 'null', '[]', '{}']) {
      value = corrupt;
      assert.deepEqual(getSavedAutoSettings(), DEFAULT_AUTO_SETTINGS);
    }
    value = JSON.stringify({ actionsPerSecond: -100, playStyle: 'unknown', lookAhead: 'false', autoFlush: 1 });
    assert.deepEqual(getSavedAutoSettings(), { ...DEFAULT_AUTO_SETTINGS, actionsPerSecond: 1 });
    globalThis.window.localStorage.getItem = () => { throw new Error('Storage unavailable'); };
    assert.deepEqual(getSavedAutoSettings(), DEFAULT_AUTO_SETTINGS);
  } finally {
    delete globalThis.window;
  }
  assert.deepEqual(normalizeAutoSettings({ actionsPerSecond: 900 }), { ...DEFAULT_AUTO_SETTINGS, actionsPerSecond: 20 });
});

test('all autopilot styles make legal placements with next-piece planning on or off', () => {
  for (const playStyle of ['balanced', 'safe', 'aggressive']) {
    for (const lookAhead of [true, false]) {
      const game = initialGame();
      game.status = 'playing';
      game.active = [spawnPiece('I', 1, 10, 'solo')];
      for (let y = 16; y < 20; y += 1) game.board[y] = Array.from({ length: 10 }, (_, x) => x === 9 ? null : { type: 'G', owner: 1 });
      const settings = { ...DEFAULT_AUTO_SETTINGS, playStyle, lookAhead };
      const before = structuredClone(game);
      const plan = planAutoPlay(game, 1, settings);
      assert.deepEqual(game, before);
      assert.ok(plan);
      for (const action of plan) executeAutoAction(game, 1, action);
      assert.equal(getCells(game.active[0]).every(({ x, y }) => x === 9 && y >= 16), true);
    }
  }
});

test('automatic Frog Flush only fires when enabled, charged, and the stack is high', () => {
  const game = initialGame();
  game.status = 'playing';
  game.meter = 100;
  game.board[10][0] = { type: 'G', owner: 1 };
  const settings = { ...DEFAULT_AUTO_SETTINGS, autoFlush: true };
  assert.equal(shouldAutoFlush(game, settings), true);
  assert.equal(shouldAutoFlush({ ...game, mode: 'coop' }, settings), true);
  assert.equal(shouldAutoFlush(game, DEFAULT_AUTO_SETTINGS), false);
  assert.equal(shouldAutoFlush({ ...game, meter: 99 }, settings), false);
  for (const status of ['ready', 'paused', 'gameover']) assert.equal(shouldAutoFlush({ ...game, status }, settings), false);
  assert.equal(shouldAutoFlush({ ...game, mode: 'duel' }, settings), false);
  game.board[10][0] = null;
  game.board[11][0] = { type: 'G', owner: 1 };
  assert.equal(shouldAutoFlush(game, settings), false);
});

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
