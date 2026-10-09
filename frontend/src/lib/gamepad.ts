export type GamepadControl =
  | 'up' | 'down' | 'left' | 'right'
  | 'south' | 'east' | 'west' | 'north' | 'start' | 'select';

export type GamepadInputControl = GamepadControl
  | 'leftBumper' | 'rightBumper' | 'leftTrigger' | 'rightTrigger'
  | 'leftStick' | 'rightStick' | 'home'
  | 'stickUp' | 'stickDown' | 'stickLeft' | 'stickRight'
  | 'rightStickUp' | 'rightStickDown' | 'rightStickLeft' | 'rightStickRight';

export type GamepadBindings = Record<GamepadControl, GamepadInputControl[]>;

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  south: ['south'], east: ['east'], west: ['west'], north: ['north'],
  select: ['select'], start: ['start'],
  up: ['up', 'stickUp'], down: ['down', 'stickDown'],
  left: ['left', 'stickLeft'], right: ['right', 'stickRight'],
};

export type ControllerStatus = {
  state: 'waiting' | 'connected' | 'unsupported' | 'unavailable';
  name?: string;
};

const BUTTONS: Partial<Record<GamepadInputControl, number>> = {
  south: 0, east: 1, west: 2, north: 3, select: 8, start: 9,
  up: 12, down: 13, left: 14, right: 15,
  leftBumper: 4, rightBumper: 5, leftTrigger: 6, rightTrigger: 7,
  leftStick: 10, rightStick: 11, home: 16,
};
const DEAD_ZONE = 0.5;
const REPEAT_DELAY = 250;
const REPEAT_INTERVAL = 85;
const DIRECTIONS: GamepadControl[] = ['up', 'down', 'left', 'right'];
const LEFT_STICK_DIRECTIONS: GamepadInputControl[] = ['stickUp', 'stickDown', 'stickLeft', 'stickRight'];

// Keep the current controller when another one is plugged in. Sparse indices
// are normal after a disconnect; an unmapped pad must not mask a supported one.
export function selectGamepad(pads: readonly (Gamepad | null)[], activeIndex: number | null) {
  const supported = pads.filter((pad): pad is Gamepad => (
    pad !== null && pad.connected && pad.mapping === 'standard'
  ));
  return supported.find((pad) => pad.index === activeIndex) ?? supported[0] ?? null;
}

export function readGamepadInputs(pad: Gamepad): Set<GamepadInputControl> {
  const controls = new Set<GamepadInputControl>();
  if (!pad.connected || pad.mapping !== 'standard') return controls;
  for (const [control, index] of Object.entries(BUTTONS)) {
    const button = pad.buttons[index];
    if (button?.pressed || (button?.value ?? 0) > 0.5) controls.add(control as GamepadInputControl);
  }

  // Read both sticks independently so custom actions can be used together.
  const readStick = (axis: number, up: GamepadInputControl, down: GamepadInputControl, left: GamepadInputControl, right: GamepadInputControl) => {
    const x = pad.axes[axis] ?? 0;
    const y = pad.axes[axis + 1] ?? 0;
    if (Math.max(Math.abs(x), Math.abs(y)) >= DEAD_ZONE) {
      if (Math.abs(x) > Math.abs(y)) controls.add(x < 0 ? left : right);
      else controls.add(y < 0 ? up : down);
    }
  };
  readStick(0, 'stickUp', 'stickDown', 'stickLeft', 'stickRight');
  readStick(2, 'rightStickUp', 'rightStickDown', 'rightStickLeft', 'rightStickRight');
  return controls;
}

export function readGamepadControls(pad: Gamepad, bindings: GamepadBindings = DEFAULT_GAMEPAD_BINDINGS): Set<GamepadControl> {
  const inputs = readGamepadInputs(pad);
  const controls = new Set<GamepadControl>();
  const dpadMoving = DIRECTIONS.some((control) => bindings[control].some((input) => (
    DIRECTIONS.includes(input as GamepadControl) && inputs.has(input)
  )));
  for (const control of Object.keys(bindings) as GamepadControl[]) {
    // Preserve D-pad priority for movement, while allowing stick directions
    // assigned to other actions (such as pause) to work independently.
    if (bindings[control].some((input) => inputs.has(input)
      && !(dpadMoving && DIRECTIONS.includes(control) && LEFT_STICK_DIRECTIONS.includes(input)))) controls.add(control);
  }
  for (const [first, second] of [['left', 'right'], ['up', 'down']] as const) {
    if (controls.has(first) && controls.has(second)) {
      controls.delete(first);
      controls.delete(second);
    }
  }
  return controls;
}

// A press used to open capture must be released first. Ambiguous combinations
// wait for neutral rather than arbitrarily selecting one of several inputs.
export class GamepadCapture {
  private ready = false;
  private identity: string | null = null;

  reset() { this.ready = false; }

  sample(pad: Gamepad | null, enabled: boolean): GamepadInputControl | null {
    const identity = pad ? `${pad.index}:${pad.id}` : null;
    if (identity !== this.identity) this.reset();
    this.identity = identity;
    if (!enabled || !pad || !pad.connected || pad.mapping !== 'standard') {
      this.reset();
      return null;
    }
    const inputs = readGamepadInputs(pad);
    if (inputs.size === 0) this.ready = true;
    if (inputs.size !== 1 || !this.ready) {
      if (inputs.size > 1) this.reset();
      return null;
    }
    this.reset();
    return inputs.values().next().value ?? null;
  }
}

export class GamepadInput {
  private held = new Map<GamepadControl, number>();
  private identity: string | null = null;
  private bindingsSignature: string | null = null;

  sample(pad: Gamepad | null, now: number, enabled: boolean, repeat: readonly GamepadControl[] = [], bindings: GamepadBindings = DEFAULT_GAMEPAD_BINDINGS) {
    const identity = pad ? `${pad.index}:${pad.id}` : null;
    if (identity !== this.identity) {
      this.held.clear();
      this.identity = identity;
    }
    const signature = JSON.stringify(bindings);
    const bindingsChanged = this.bindingsSignature !== null && this.bindingsSignature !== signature;
    this.bindingsSignature = signature;
    if (bindingsChanged) this.held.clear();
    const controls = pad ? readGamepadControls(pad, bindings) : new Set<GamepadControl>();
    const actions: GamepadControl[] = [];
    for (const control of this.held.keys()) {
      if (!controls.has(control)) this.held.delete(control);
    }
    for (const control of controls) {
      const nextRepeat = this.held.get(control);
      // Inputs held while inactive must be released before they act again.
      if (!enabled || bindingsChanged) {
        this.held.set(control, Infinity);
      } else if (nextRepeat === undefined) {
        actions.push(control);
        this.held.set(control, now + REPEAT_DELAY);
      } else if (repeat.includes(control) && now >= nextRepeat) {
        actions.push(control);
        // Emit at most once per frame, even after a long frame or tab switch.
        this.held.set(control, now + REPEAT_INTERVAL);
      }
    }
    return actions;
  }
}
