import {
  COOP_COLS,
  DEFAULT_BINDINGS,
  KEY_BINDINGS_STORAGE_KEY,
  KEYBOARD_ACTIONS,
  MULTIPLAYER_SESSION_STORAGE_KEY,
  ROWS,
  SOLO_COLS,
} from './constants';
import { makeBoard } from './game-logic';
import type {
  CoopState,
  GameMode,
  GameState,
  KeyboardBindings,
  SavedMultiplayerSession,
} from './types';

export const getSavedBest = (mode: GameMode) => {
  if (typeof window === 'undefined') return 0;
  const key = mode === 'coop'
    ? 'shkermitStacksCoopBest'
    : mode === 'duel' ? 'shkermitStacksDuelBest' : 'shkermitStacksBest';
  return Number.parseInt(window.localStorage.getItem(key) || '0', 10) || 0;
};

export const getSavedBindings = (): KeyboardBindings => {
  if (typeof window === 'undefined') return DEFAULT_BINDINGS;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(KEY_BINDINGS_STORAGE_KEY) || 'null',
    ) as Partial<KeyboardBindings> | null;
    if (!saved) return DEFAULT_BINDINGS;
    const bindings = {} as KeyboardBindings;
    const used = new Set<string>();
    // Restore existing custom keys before assigning defaults for new actions.
    for (const action of KEYBOARD_ACTIONS) {
      const binding = saved[action];
      if (!binding) continue;
      if (typeof binding.code !== 'string' || typeof binding.label !== 'string' || used.has(binding.code)) return DEFAULT_BINDINGS;
      bindings[action] = binding;
      used.add(binding.code);
    }
    for (const action of KEYBOARD_ACTIONS) {
      if (bindings[action]) continue;
      const fallback = [DEFAULT_BINDINGS[action], ...Object.values(DEFAULT_BINDINGS)]
        .find((binding) => !used.has(binding.code));
      if (!fallback) return DEFAULT_BINDINGS;
      bindings[action] = { ...fallback };
      used.add(fallback.code);
    }
    return bindings;
  } catch {
    return DEFAULT_BINDINGS;
  }
};

export const keyLabelFromEvent = (event: KeyboardEvent) => {
  const labels: Record<string, string> = {
    ' ': 'SPACE',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Control: 'CTRL',
  };
  if (labels[event.key]) return labels[event.key];
  if (event.key.length === 1) return event.key.toUpperCase();
  return event.key.toUpperCase().replace('LEFT', 'L ').replace('RIGHT', 'R ');
};

export const initialGame = (mode: GameMode = 'solo'): GameState => ({
  mode,
  board: makeBoard(mode === 'coop' ? COOP_COLS : SOLO_COLS),
  duelBoards: mode === 'duel' ? { 1: makeBoard(SOLO_COLS), 2: makeBoard(SOLO_COLS) } : null,
  active: [],
  status: 'ready',
  cols: mode === 'coop' ? COOP_COLS : SOLO_COLS,
  score: 0,
  lines: 0,
  level: 1,
  combo: -1,
  backToBack: false,
  best: getSavedBest(mode),
  meter: 0,
  next: { 1: 'T', 2: 'L' },
  hold: { 1: null, 2: null },
  holdUsed: { 1: false, 2: false },
  playerStats: {
    1: { score: 0, lines: 0, combo: -1, backToBack: false },
    2: { score: 0, lines: 0, combo: -1, backToBack: false },
  },
  winner: null,
  message: 'Ready to stack',
});

export const initialCoop = (): CoopState => ({
  phase: 'idle',
  roomCode: '',
  playerId: null,
  playerNames: { 1: null, 2: null },
  error: '',
});

export const isGameState = (value: unknown): value is GameState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;
  return (state.mode === 'coop' || state.mode === 'duel')
    && state.cols === (state.mode === 'duel' ? SOLO_COLS : COOP_COLS)
    && Array.isArray(state.board)
    && state.board.length === ROWS
    && state.board.every((row) => Array.isArray(row) && row.length === state.cols)
    && (state.mode !== 'duel'
      || Boolean(state.duelBoards
        && [state.duelBoards[1], state.duelBoards[2]].every((board) => (
          Array.isArray(board)
          && board.length === ROWS
          && board.every((row) => Array.isArray(row) && row.length === SOLO_COLS)
        ))))
    && Array.isArray(state.active)
    && ['ready', 'playing', 'paused', 'gameover'].includes(state.status || '')
    && typeof state.score === 'number'
    && typeof state.lines === 'number'
    && Boolean(state.playerStats
      && [state.playerStats[1], state.playerStats[2]].every((stats) => (
        stats
        && typeof stats.score === 'number'
        && typeof stats.lines === 'number'
        && typeof stats.combo === 'number'
      )))
    && Boolean(state.next?.[1] && state.next?.[2]);
};

export const getSavedMultiplayerSession = (): SavedMultiplayerSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(
      window.sessionStorage.getItem(MULTIPLAYER_SESSION_STORAGE_KEY) || 'null',
    ) as SavedMultiplayerSession | null;
    if (!saved
      || !/^[A-Z2-9]{5}$/.test(saved.roomCode)
      || (saved.playerId !== 1 && saved.playerId !== 2)
      || typeof saved.resumeToken !== 'string'
      || (saved.gameMode !== 'coop' && saved.gameMode !== 'duel')) return null;
    if (saved.game && !isGameState(saved.game)) delete saved.game;
    return saved;
  } catch {
    return null;
  }
};

export const persistMultiplayerSession = (session: SavedMultiplayerSession) => {
  window.sessionStorage.setItem(MULTIPLAYER_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearMultiplayerSession = () => {
  window.sessionStorage.removeItem(MULTIPLAYER_SESSION_STORAGE_KEY);
};
