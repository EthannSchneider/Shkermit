import { DEFAULT_GAMEPAD_BINDINGS } from './gamepad';
import type { GamepadBindings, GamepadControl, GamepadInputControl } from './gamepad';

export type ControllerGame = 'snake' | 'clicker' | 'tetris';

export const CONTROLLER_INPUT_LABELS: Record<GamepadInputControl, string> = {
  up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →',
  south: 'A / Cross', east: 'B / Circle', west: 'X / Square', north: 'Y / Triangle',
  start: 'Start / Options', select: 'Back / Share',
  leftBumper: 'LB / L1', rightBumper: 'RB / R1', leftTrigger: 'LT / L2', rightTrigger: 'RT / R2',
  leftStick: 'Left stick press (L3)', rightStick: 'Right stick press (R3)', home: 'Home / PS',
  stickUp: 'Left stick ↑', stickDown: 'Left stick ↓', stickLeft: 'Left stick ←', stickRight: 'Left stick →',
  rightStickUp: 'Right stick ↑', rightStickDown: 'Right stick ↓', rightStickLeft: 'Right stick ←', rightStickRight: 'Right stick →',
};

type ControllerAction = { control: GamepadControl; label: string };

export const CONTROLLER_ACTIONS: Record<ControllerGame, ControllerAction[]> = {
  snake: [
    { control: 'up', label: 'Steer up' }, { control: 'down', label: 'Steer down' },
    { control: 'left', label: 'Steer left' }, { control: 'right', label: 'Steer right' },
    { control: 'south', label: 'Start / play again' }, { control: 'start', label: 'Pause / resume (also starts)' },
  ],
  clicker: [
    { control: 'up', label: 'Previous button (up)' }, { control: 'down', label: 'Next button (down)' },
    { control: 'left', label: 'Previous button (left)' }, { control: 'right', label: 'Next button (right)' },
    { control: 'south', label: 'Click / activate selection' }, { control: 'west', label: 'Earn (hold to repeat)' },
    { control: 'east', label: 'Dismiss victory' },
  ],
  tetris: [
    { control: 'left', label: 'Move left' }, { control: 'right', label: 'Move right' },
    { control: 'down', label: 'Soft drop' }, { control: 'up', label: 'Rotate (alternate)' },
    { control: 'south', label: 'Rotate / start solo' }, { control: 'west', label: 'Hard drop / create co-op' },
    { control: 'north', label: 'Frog Flush / create duel' }, { control: 'start', label: 'Pause / resume / start solo' },
    { control: 'select', label: 'Restart' }, { control: 'east', label: 'Menu / cancel room' },
  ],
};

export const controllerStorageKey = (game: ControllerGame) => `shkermitControllerBindings:${game}:v1`;

export const defaultControllerBindings = (): GamepadBindings => Object.fromEntries(
  Object.entries(DEFAULT_GAMEPAD_BINDINGS).map(([action, inputs]) => [action, [...inputs]]),
) as GamepadBindings;

export function parseControllerBindings(saved: string | null): GamepadBindings {
  try {
    const value: unknown = JSON.parse(saved ?? 'null');
    if (!value || typeof value !== 'object') return defaultControllerBindings();
    const candidate = value as Record<string, unknown>;
    const used = new Set<string>();
    const bindings = defaultControllerBindings();
    for (const control of Object.keys(bindings) as GamepadControl[]) {
      const inputs = candidate[control];
      if (!Array.isArray(inputs) || !inputs.length) return defaultControllerBindings();
      for (const input of inputs) {
        if (typeof input !== 'string' || !Object.hasOwn(CONTROLLER_INPUT_LABELS, input) || used.has(input)) return defaultControllerBindings();
        used.add(input);
      }
      bindings[control] = [...inputs] as GamepadInputControl[];
    }
    return bindings;
  } catch {
    return defaultControllerBindings();
  }
}

export function rebindControllerAction(bindings: GamepadBindings, action: GamepadControl, input: GamepadInputControl): GamepadBindings {
  const next = Object.fromEntries(Object.entries(bindings).map(([control, inputs]) => [control, [...inputs]])) as GamepadBindings;
  const other = (Object.keys(next) as GamepadControl[]).find((control) => control !== action && next[control].includes(input));
  if (other) next[other] = [...next[action]];
  next[action] = [input];
  return next;
}

export const controllerBindingLabel = (bindings: GamepadBindings, action: GamepadControl) => (
  bindings[action].map((input) => CONTROLLER_INPUT_LABELS[input]).join(' or ')
);
