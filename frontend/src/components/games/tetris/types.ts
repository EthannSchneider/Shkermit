export type PieceName = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type CellType = PieceName | 'G';
export type PlayerId = 1 | 2;
export type GameMode = 'solo' | 'coop' | 'duel';
export type GameStatus = 'ready' | 'playing' | 'paused' | 'gameover';
export type Action = 'left' | 'right' | 'rotate' | 'rotate_ccw' | 'down' | 'drop' | 'hold';
export type GameCommand = 'toggle_pause' | 'restart' | 'frog_flush';
export type CoopPhase = 'idle' | 'connecting' | 'hosting' | 'connected' | 'error';
export type KeyboardAction = Action | 'pause' | 'restart' | 'frogFlush';

export type KeyBinding = {
  code: string;
  label: string;
};

export type KeyboardBindings = Record<KeyboardAction, KeyBinding>;

export type Cell = {
  type: CellType;
  owner: PlayerId;
};

export type PlayerStats = {
  score: number;
  lines: number;
  combo: number;
  backToBack?: boolean;
};

export type ActivePiece = {
  type: PieceName;
  player: PlayerId;
  rotation: number;
  x: number;
  y: number;
  lockElapsed?: number;
  lockResets?: number;
  lastRotationKick?: number;
};

export type GameState = {
  mode: GameMode;
  board: (Cell | null)[][];
  duelBoards: Record<PlayerId, (Cell | null)[][]> | null;
  active: ActivePiece[];
  status: GameStatus;
  cols: number;
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBack?: boolean;
  best: number;
  meter: number;
  next: Record<PlayerId, PieceName>;
  hold: Record<PlayerId, PieceName | null>;
  holdUsed: Record<PlayerId, boolean>;
  playerStats: Record<PlayerId, PlayerStats>;
  winner: PlayerId | null;
  message: string;
};

export type SavedMultiplayerSession = {
  roomCode: string;
  playerId: PlayerId;
  resumeToken: string;
  gameMode: 'coop' | 'duel';
  game?: GameState;
  bag?: PieceName[];
  duelSequence?: PieceName[];
  duelDrawIndex?: Record<PlayerId, number>;
};

export type CoopState = {
  phase: CoopPhase;
  roomCode: string;
  playerId: PlayerId | null;
  playerNames: Record<PlayerId, string | null>;
  error: string;
};

export type RenderedCell = {
  cell: Cell;
  ghost?: boolean;
  active?: boolean;
};

export type TetrisGameController = {
  game: GameState;
  bestScores: Record<GameMode, number>;
  coop: CoopState;
  joinCode: string;
  setJoinCode: Dispatch<SetStateAction<string>>;
  keyBindings: KeyboardBindings;
  bindingAction: KeyboardAction | null;
  setBindingAction: Dispatch<SetStateAction<KeyboardAction | null>>;
  resetBindings: () => void;
  startSolo: () => void;
  connectToCoop: (
    kind: 'create' | 'join' | 'resume',
    roomCode?: string,
    gameMode?: 'coop' | 'duel',
    resumeToken?: string,
    restoredGame?: GameState,
  ) => void;
  leaveCoop: () => void;
  sendAction: (player: PlayerId, action: Action) => void;
  sendCommand: (command: GameCommand) => void;
  renderedBoards: Record<PlayerId, Map<string, RenderedCell>>;
  returnToMenu: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  canAutoPlay: boolean;
  autoEnabled: boolean;
  toggleAuto: () => void;
};
import type { Dispatch, SetStateAction } from 'react';
