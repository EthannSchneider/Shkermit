import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(file) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const gamepadUrl = await moduleUrl('../src/lib/gamepad.ts');
const source = await readFile(new URL('../src/lib/controller-bindings.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const linked = outputText.replace("'./gamepad'", JSON.stringify(gamepadUrl));
const { controllerStorageKey, defaultControllerBindings, parseControllerBindings, rebindControllerAction, controllerBindingLabel } = await import(
  `data:text/javascript;base64,${Buffer.from(linked).toString('base64')}`
);

test('saved controller profiles are separate for each game and survive serialization', () => {
  assert.equal(new Set(['snake', 'clicker', 'tetris'].map(controllerStorageKey)).size, 3);
  const bindings = rebindControllerAction(defaultControllerBindings(), 'west', 'rightTrigger');
  assert.deepEqual(parseControllerBindings(JSON.stringify(bindings)), bindings);
  assert.equal(controllerBindingLabel(bindings, 'west'), 'RT / R2');
});

test('binding an occupied input swaps actions and preserves unique bindings', () => {
  const original = defaultControllerBindings();
  const swapped = rebindControllerAction(original, 'south', 'west');
  assert.deepEqual(swapped.south, ['west']);
  assert.deepEqual(swapped.west, ['south']);
  assert.deepEqual(original.south, ['south']);
  assert.deepEqual(parseControllerBindings(JSON.stringify(swapped)), swapped);
  const directionSwap = rebindControllerAction(original, 'west', 'left');
  assert.deepEqual(directionSwap.left, ['west']);
  assert.deepEqual(directionSwap.west, ['left']);
  assert.deepEqual(parseControllerBindings(JSON.stringify(directionSwap)), directionSwap);
});

test('corrupt, incomplete, unknown, empty, or duplicate saved inputs restore defaults', () => {
  const defaults = defaultControllerBindings();
  for (const saved of [
    null, '{broken', 'null', '42', '{}', JSON.stringify({ ...defaults, west: 'south' }),
    JSON.stringify({ ...defaults, west: [] }), JSON.stringify({ ...defaults, west: ['missing'] }),
    JSON.stringify({ ...defaults, west: ['south'] }), JSON.stringify({ ...defaults, west: ['west', 'west'] }),
    JSON.stringify({ ...defaults, west: ['__proto__'] }),
  ]) assert.deepEqual(parseControllerBindings(saved), defaults);
});

test('restoring defaults returns fresh arrays without changing another game profile', () => {
  const snake = defaultControllerBindings();
  const tetris = rebindControllerAction(defaultControllerBindings(), 'south', 'rightBumper');
  snake.south.push('home');
  assert.deepEqual(defaultControllerBindings().south, ['south']);
  assert.deepEqual(tetris.south, ['rightBumper']);
});
