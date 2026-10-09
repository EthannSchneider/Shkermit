import type { CellType, KeyboardAction, KeyboardBindings, PieceName, PlayerId } from './types';

export const ROWS = 20;
export const SOLO_COLS = 10;
export const COOP_COLS = 14;
export const LOCK_DELAY = 500;
export const MAX_LOCK_RESETS = 15;
export const MOVEMENT_REPEAT = { delay: 140, interval: 35 };
export const PIECES: PieceName[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const KEYBOARD_ACTIONS: KeyboardAction[] = [
  'left',
  'right',
  'rotate',
  'rotate_ccw',
  'down',
  'drop',
  'hold',
  'pause',
  'restart',
  'frogFlush',
];

export const KEYBOARD_ACTION_LABELS: Record<KeyboardAction, string> = {
  left: 'Move left',
  right: 'Move right',
  rotate: 'Rotate clockwise',
  rotate_ccw: 'Rotate counterclockwise',
  down: 'Soft drop',
  drop: 'Hard drop',
  hold: 'Hold piece',
  pause: 'Pause',
  restart: 'Restart',
  frogFlush: 'Frog Flush',
};

export const DEFAULT_BINDINGS: KeyboardBindings = {
  left: { code: 'KeyA', label: 'A' },
  right: { code: 'KeyD', label: 'D' },
  rotate: { code: 'KeyW', label: 'W' },
  rotate_ccw: { code: 'KeyQ', label: 'Q' },
  down: { code: 'KeyS', label: 'S' },
  drop: { code: 'KeyF', label: 'F' },
  hold: { code: 'KeyC', label: 'C' },
  pause: { code: 'KeyP', label: 'P' },
  restart: { code: 'KeyR', label: 'R' },
  frogFlush: { code: 'KeyB', label: 'B' },
};

export const KEY_BINDINGS_STORAGE_KEY = 'shkermitStacksKeyBindings';
export const MULTIPLAYER_SESSION_STORAGE_KEY = 'shkermitStacksMultiplayerSession';

export const BASE_SHAPES: Record<PieceName, string[]> = {
  I: ['....', '####', '....', '....'],
  O: ['##', '##'],
  T: ['.#.', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
};

export const PIECE_COLORS: Record<CellType, string> = {
  I: '#35d7ff',
  O: '#ffe44f',
  T: '#ba70ff',
  S: '#74e06f',
  Z: '#ff607a',
  J: '#5d8cff',
  L: '#ff9b45',
  G: '#56615a',
};

export const PLAYER_COLORS: Record<PlayerId, string> = {
  1: '#b5ff4a',
  2: '#ff73d1',
};
