import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Transpile the dependency-free input module in memory so these checks also
// run on Node 20, without adding a test runner or generated files to the repo.
const source = await readFile(new URL('../src/lib/gamepad.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { GamepadCapture, GamepadInput, DEFAULT_GAMEPAD_BINDINGS, readGamepadInputs, readGamepadControls, selectGamepad } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

function pad({ buttons = [], axes = [0, 0], index = 0, id = 'test controller', mapping = 'standard', connected = true } = {}) {
  return {
    index, id, mapping, connected, axes,
    buttons: Array.from({ length: 17 }, (_, button) => ({ pressed: buttons.includes(button), value: buttons.includes(button) ? 1 : 0 })),
  };
}

test('standard face, menu, and D-pad buttons map to the expected controls', () => {
  const mappings = { 0: 'south', 1: 'east', 2: 'west', 3: 'north', 8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  for (const [button, control] of Object.entries(mappings)) {
    assert.deepEqual([...readGamepadControls(pad({ buttons: [Number(button)] }))], [control]);
  }
  const analogButton = pad();
  analogButton.buttons[0] = { pressed: false, value: 0.75 };
  assert.deepEqual([...readGamepadControls(analogButton)], ['south']);
});

test('stick drift is ignored and diagonals use only the dominant axis', () => {
  assert.deepEqual([...readGamepadControls(pad({ axes: [0.3, -0.4] }))], []);
  assert.deepEqual([...readGamepadControls(pad({ axes: [-0.9, -0.6] }))], ['left']);
  assert.deepEqual([...readGamepadControls(pad({ axes: [0.7, 0.9] }))], ['down']);
  assert.deepEqual([...readGamepadControls(pad({ axes: [0.5, 0] }))], ['right']);
  assert.deepEqual([...readGamepadControls(pad({ axes: [0, -0.8], buttons: [15] }))], ['right']);
});

test('opposite D-pad inputs cancel and unsupported pads cannot send actions', () => {
  assert.deepEqual([...readGamepadControls(pad({ buttons: [12, 13, 14, 15] }))], []);
  assert.deepEqual([...readGamepadControls(pad({ buttons: [0], mapping: '' }))], []);
  assert.deepEqual([...readGamepadControls(pad({ buttons: [0], connected: false }))], []);
});

test('pause, rotate, drop, and restart act once per press even when held', () => {
  const input = new GamepadInput();
  const held = pad({ buttons: [0, 2, 8, 9] });
  assert.deepEqual(input.sample(held, 0, true, ['left', 'right', 'down']), ['south', 'west', 'select', 'start']);
  assert.deepEqual(input.sample(held, 1000, true, ['left', 'right', 'down']), []);
  input.sample(pad(), 1001, true);
  assert.deepEqual(input.sample(held, 1010, true), ['south', 'west', 'select', 'start']);
});

test('movement and clicker earning repeat after a delay, at most once per frame', () => {
  const input = new GamepadInput();
  const held = pad({ buttons: [2, 15] });
  const repeat = ['right', 'west'];
  assert.deepEqual(input.sample(held, 0, true, repeat), ['west', 'right']);
  assert.deepEqual(input.sample(held, 249, true, repeat), []);
  assert.deepEqual(input.sample(held, 250, true, repeat), ['west', 'right']);
  assert.deepEqual(input.sample(held, 334, true, repeat), []);
  assert.deepEqual(input.sample(held, 335, true, repeat), ['west', 'right']);
  assert.deepEqual(input.sample(held, 10000, true, repeat), ['west', 'right']);
  assert.deepEqual(input.sample(held, 10001, true, repeat), []);
});

test('focus loss or disabled controls suppress held actions until release', () => {
  const input = new GamepadInput();
  const held = pad({ buttons: [9, 15] });
  assert.deepEqual(input.sample(held, 0, true, ['right']), ['start', 'right']);
  assert.deepEqual(input.sample(held, 10, false, ['right']), []);
  assert.deepEqual(input.sample(held, 1000, true, ['right']), []);
  input.sample(pad(), 1001, true);
  assert.deepEqual(input.sample(held, 1002, true, ['right']), ['start', 'right']);
  const newInput = new GamepadInput();
  assert.deepEqual(newInput.sample(held, 0, false), []);
  assert.deepEqual(newInput.sample(held, 1, true), []);
});

test('disconnects and controller replacements clear held inputs', () => {
  const input = new GamepadInput();
  const held = pad({ buttons: [0] });
  assert.deepEqual(input.sample(held, 0, true), ['south']);
  assert.deepEqual(input.sample(null, 1, true), []);
  assert.deepEqual(input.sample(held, 2, true), ['south']);
  assert.deepEqual(input.sample(pad({ buttons: [0], id: 'replacement' }), 3, true), ['south']);
});

test('selection supports sparse slots, skips unmapped pads, and stays on the active controller', () => {
  const first = pad({ index: 1 });
  const second = pad({ index: 3 });
  const unmapped = pad({ mapping: '' });
  assert.equal(selectGamepad([unmapped, first, null, second], null), first);
  assert.equal(selectGamepad([unmapped, first, null, second], 3), second);
  assert.equal(selectGamepad([unmapped, first, null, null], 3), first);
  assert.equal(selectGamepad([unmapped, null, pad({ connected: false })], null), null);
});

test('raw inputs distinguish stick directions and expose bumpers, triggers, and stick presses', () => {
  assert.deepEqual([...readGamepadInputs(pad({ axes: [-0.9, 0, 0, 0.8] }))], ['stickLeft', 'rightStickDown']);
  const mappings = { 4: 'leftBumper', 5: 'rightBumper', 6: 'leftTrigger', 7: 'rightTrigger', 10: 'leftStick', 11: 'rightStick', 16: 'home' };
  for (const [button, input] of Object.entries(mappings)) {
    assert.deepEqual([...readGamepadInputs(pad({ buttons: [Number(button)] }))], [input]);
  }
});

test('a stick direction assigned to pause works while the D-pad is moving', () => {
  const bindings = { ...DEFAULT_GAMEPAD_BINDINGS, start: ['stickUp'], up: ['up'] };
  const held = pad({ buttons: [15], axes: [0, -0.8] });
  assert.deepEqual([...readGamepadInputs(held)], ['right', 'stickUp']);
  assert.deepEqual([...readGamepadControls(held, bindings)], ['start', 'right']);
  assert.deepEqual([...readGamepadControls(held)], ['right']);
});

test('opposite physical directions can trigger separate custom actions but cannot fool capture', () => {
  const bindings = { ...DEFAULT_GAMEPAD_BINDINGS, left: ['leftTrigger'], right: ['rightTrigger'], west: ['left'], start: ['right'] };
  const held = pad({ buttons: [14, 15] });
  assert.deepEqual([...readGamepadControls(held, bindings)], ['west', 'start']);
  const capture = new GamepadCapture();
  capture.sample(pad(), true);
  assert.equal(capture.sample(held, true), null);
  assert.equal(capture.sample(pad({ buttons: [14] }), true), null);
});

test('custom buttons trigger the chosen logical action and its repeat policy', () => {
  const bindings = { ...DEFAULT_GAMEPAD_BINDINGS, left: ['rightTrigger'], west: ['rightStickUp'] };
  const input = new GamepadInput();
  const held = pad({ buttons: [7], axes: [0, 0, 0, -0.8] });
  assert.deepEqual(input.sample(held, 0, true, ['left'], bindings), ['west', 'left']);
  assert.deepEqual(input.sample(held, 250, true, ['left'], bindings), ['left']);
  assert.deepEqual(input.sample(pad({ buttons: [14] }), 300, true, ['left'], bindings), []);
});

test('changing a binding while its button is held cannot trigger gameplay until release', () => {
  const input = new GamepadInput();
  const held = pad({ buttons: [0] });
  input.sample(held, 0, false);
  const bindings = { ...DEFAULT_GAMEPAD_BINDINGS, south: ['west'], west: ['south'] };
  assert.deepEqual(input.sample(held, 1, true, ['west'], bindings), []);
  assert.deepEqual(input.sample(held, 1000, true, ['west'], bindings), []);
  input.sample(pad(), 1001, true, ['west'], bindings);
  assert.deepEqual(input.sample(held, 1002, true, ['west'], bindings), ['west']);
});

test('capture requires neutral, captures a single raw input, and resets after capture', () => {
  const capture = new GamepadCapture();
  assert.equal(capture.sample(pad({ buttons: [0] }), true), null);
  assert.equal(capture.sample(pad(), true), null);
  assert.equal(capture.sample(pad({ buttons: [5] }), true), 'rightBumper');
  assert.equal(capture.sample(pad({ buttons: [5] }), true), null);
  capture.sample(pad(), true);
  assert.equal(capture.sample(pad({ axes: [0, 0, -0.9, 0] }), true), 'rightStickLeft');
});

test('ambiguous captures and focus loss require neutral before accepting another input', () => {
  const capture = new GamepadCapture();
  capture.sample(pad(), true);
  assert.equal(capture.sample(pad({ buttons: [0, 1] }), true), null);
  assert.equal(capture.sample(pad({ buttons: [0] }), true), null);
  capture.sample(pad(), true);
  capture.sample(pad(), false);
  assert.equal(capture.sample(pad({ buttons: [0] }), true), null);
  capture.sample(pad(), true);
  capture.sample(null, true);
  assert.equal(capture.sample(pad({ buttons: [0] }), true), null);
  capture.sample(pad(), true);
  assert.equal(capture.sample(pad({ buttons: [0] }), true), 'south');
});

test('capture requires neutral after replacing the active controller', () => {
  const capture = new GamepadCapture();
  capture.sample(pad(), true);
  assert.equal(capture.sample(pad({ id: 'replacement', buttons: [0] }), true), null);
  capture.sample(pad({ id: 'replacement' }), true);
  assert.equal(capture.sample(pad({ id: 'replacement', buttons: [0] }), true), 'south');
});
