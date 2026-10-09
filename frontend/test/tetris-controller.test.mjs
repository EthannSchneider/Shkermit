import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/games/tetris/controller-input.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { handleTetrisController } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

function controller({ mode = 'solo', status = 'playing', playerId = null, phase = 'idle' } = {}) {
  const calls = [];
  return {
    calls,
    game: { mode, status },
    coop: { playerId, phase },
    ...Object.fromEntries(['startSolo', 'connectToCoop', 'leaveCoop', 'sendAction', 'sendCommand', 'returnToMenu'].map(
      (method) => [method, (...args) => calls.push([method, ...args])],
    )),
  };
}

test('solo controller inputs use gameplay actions for player one', () => {
  const game = controller();
  for (const control of ['left', 'right', 'down', 'up', 'south', 'west', 'east', 'north']) handleTetrisController(control, game);
  assert.deepEqual(game.calls, [
    ['sendAction', 1, 'left'], ['sendAction', 1, 'right'], ['sendAction', 1, 'down'],
    ['sendAction', 1, 'rotate_ccw'], ['sendAction', 1, 'rotate'], ['sendAction', 1, 'drop'], ['sendAction', 1, 'hold'],
    ['sendCommand', 'frog_flush'],
  ]);
});

test('online co-op and duel actions target the local seat, including player two', () => {
  for (const mode of ['coop', 'duel']) {
    for (const playerId of [1, 2]) {
      const game = controller({ mode, playerId, phase: 'connected' });
      handleTetrisController('left', game);
      handleTetrisController('west', game);
      handleTetrisController('up', game);
      handleTetrisController('east', game);
      assert.deepEqual(game.calls, [['sendAction', playerId, 'left'], ['sendAction', playerId, 'drop'], ['sendAction', playerId, 'rotate_ccw'], ['sendAction', playerId, 'hold']]);
    }
    const game = controller({ mode, playerId: null });
    handleTetrisController('west', game);
    assert.deepEqual(game.calls, []);
  }
});

test('paused and finished games ignore movement but permit resume, restart, and menu', () => {
  for (const status of ['paused', 'gameover']) {
    const game = controller({ status });
    for (const control of ['left', 'south', 'west', 'north', 'start', 'select', 'east']) handleTetrisController(control, game);
    assert.deepEqual(game.calls, [['sendCommand', 'toggle_pause'], ['sendCommand', 'restart'], ['returnToMenu']]);
  }
});

test('ready menu buttons start solo or create the requested online mode', () => {
  const game = controller({ status: 'ready' });
  for (const control of ['south', 'start', 'west', 'north']) handleTetrisController(control, game);
  assert.deepEqual(game.calls, [['startSolo'], ['startSolo'], ['connectToCoop', 'create', '', 'coop'], ['connectToCoop', 'create', '', 'duel']]);
});

test('a pending online room cannot be replaced with another game by a controller press', () => {
  for (const phase of ['connecting', 'hosting', 'connected']) {
    const game = controller({ status: 'ready', mode: 'coop', phase });
    for (const control of ['south', 'start', 'west', 'north', 'select', 'east']) handleTetrisController(control, game);
    assert.deepEqual(game.calls, [['leaveCoop']]);
  }
});
