import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import shkermitImage from '../../assets/img/3 TeteShkermit RTX.png';

type PieceName = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type CellType = PieceName | 'G';
type PlayerId = 1 | 2;
type GameMode = 'solo' | 'coop' | 'duel';
type GameStatus = 'ready' | 'playing' | 'paused' | 'gameover';
type Action = 'left' | 'right' | 'rotate' | 'down' | 'drop';
type GameCommand = 'toggle_pause' | 'restart' | 'frog_flush';
type CoopPhase = 'idle' | 'connecting' | 'hosting' | 'connected' | 'error';
type KeyboardAction = Action | 'pause' | 'restart' | 'frogFlush';
type KeyBinding = { code: string; label: string };
type KeyboardBindings = Record<KeyboardAction, KeyBinding>;

type Cell = {
  type: CellType;
  owner: PlayerId;
};

type PlayerStats = {
  score: number;
  lines: number;
  combo: number;
};

type ActivePiece = {
  type: PieceName;
  player: PlayerId;
  rotation: number;
  x: number;
  y: number;
};

type GameState = {
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
  best: number;
  meter: number;
  next: Record<PlayerId, PieceName>;
  playerStats: Record<PlayerId, PlayerStats>;
  winner: PlayerId | null;
  message: string;
};

type SavedMultiplayerSession = {
  roomCode: string;
  playerId: PlayerId;
  resumeToken: string;
  gameMode: 'coop' | 'duel';
  game?: GameState;
  bag?: PieceName[];
  duelSequence?: PieceName[];
  duelDrawIndex?: Record<PlayerId, number>;
};

type CoopState = {
  phase: CoopPhase;
  roomCode: string;
  playerId: PlayerId | null;
  error: string;
};

const ROWS = 20;
const SOLO_COLS = 10;
const COOP_COLS = 14;
const PIECES: PieceName[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const KEYBOARD_ACTIONS: KeyboardAction[] = ['left', 'right', 'rotate', 'down', 'drop', 'pause', 'restart', 'frogFlush'];
const KEYBOARD_ACTION_LABELS: Record<KeyboardAction, string> = {
  left: 'Move left',
  right: 'Move right',
  rotate: 'Rotate',
  down: 'Soft drop',
  drop: 'Hard drop',
  pause: 'Pause',
  restart: 'Restart',
  frogFlush: 'Frog Flush',
};
const DEFAULT_BINDINGS: KeyboardBindings = {
  left: { code: 'KeyA', label: 'A' },
  right: { code: 'KeyD', label: 'D' },
  rotate: { code: 'KeyW', label: 'W' },
  down: { code: 'KeyS', label: 'S' },
  drop: { code: 'KeyF', label: 'F' },
  pause: { code: 'KeyP', label: 'P' },
  restart: { code: 'KeyR', label: 'R' },
  frogFlush: { code: 'KeyB', label: 'B' },
};
const KEY_BINDINGS_STORAGE_KEY = 'shkermitStacksKeyBindings';
const MULTIPLAYER_SESSION_STORAGE_KEY = 'shkermitStacksMultiplayerSession';

const BASE_SHAPES: Record<PieceName, string[]> = {
  I: ['....', '####', '....', '....'],
  O: ['##', '##'],
  T: ['.#.', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
};

const PIECE_COLORS: Record<CellType, string> = {
  I: '#35d7ff',
  O: '#ffe44f',
  T: '#ba70ff',
  S: '#74e06f',
  Z: '#ff607a',
  J: '#5d8cff',
  L: '#ff9b45',
  G: '#56615a',
};

const PLAYER_COLORS: Record<PlayerId, string> = {
  1: '#b5ff4a',
  2: '#ff73d1',
};

const rotateMatrix = (matrix: string[]) => {
  const size = matrix.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - col - 1][row]).join(''),
  );
};

const getShape = (type: PieceName, rotation: number) => {
  let shape = BASE_SHAPES[type];
  for (let step = 0; step < rotation % 4; step += 1) shape = rotateMatrix(shape);
  return shape;
};

const getCells = (piece: ActivePiece) => {
  const cells: { x: number; y: number }[] = [];
  getShape(piece.type, piece.rotation).forEach((row, rowIndex) => {
    [...row].forEach((value, colIndex) => {
      if (value === '#') cells.push({ x: piece.x + colIndex, y: piece.y + rowIndex });
    });
  });
  return cells;
};

const makeBoard = (cols: number): (Cell | null)[][] =>
  Array.from({ length: ROWS }, () => Array<Cell | null>(cols).fill(null));

const spawnPiece = (type: PieceName, player: PlayerId, cols: number, mode: GameMode): ActivePiece => {
  const width = getShape(type, 0).length;
  const center = mode === 'coop' ? cols * (player === 1 ? 0.28 : 0.72) : cols / 2;
  return {
    type,
    player,
    rotation: 0,
    x: Math.max(0, Math.min(cols - width, Math.round(center - width / 2))),
    y: type === 'I' ? -1 : 0,
  };
};

const isValid = (
  piece: ActivePiece,
  board: (Cell | null)[][],
  active: ActivePiece[],
  cols: number,
) => {
  const otherCells = new Set(
    active
      .filter((other) => other.player !== piece.player)
      .flatMap(getCells)
      .map(({ x, y }) => `${x}:${y}`),
  );

  return getCells(piece).every(({ x, y }) => {
    if (x < 0 || x >= cols || y >= ROWS) return false;
    if (y >= 0 && board[y][x]) return false;
    return !otherCells.has(`${x}:${y}`);
  });
};

const getGhost = (piece: ActivePiece, board: (Cell | null)[][], active: ActivePiece[], cols: number) => {
  let ghost = { ...piece };
  while (isValid({ ...ghost, y: ghost.y + 1 }, board, active, cols)) {
    ghost = { ...ghost, y: ghost.y + 1 };
  }
  return ghost;
};

const getPlayerBoard = (game: GameState, player: PlayerId) => (
  game.mode === 'duel' ? game.duelBoards![player] : game.board
);

const getCollidingPieces = (game: GameState, player: PlayerId) => (
  game.mode === 'duel' ? game.active.filter((piece) => piece.player === player) : game.active
);

const getSavedBest = (mode: GameMode) => {
  if (typeof window === 'undefined') return 0;
  const key = mode === 'coop'
    ? 'shkermitStacksCoopBest'
    : mode === 'duel' ? 'shkermitStacksDuelBest' : 'shkermitStacksBest';
  return Number.parseInt(window.localStorage.getItem(key) || '0', 10) || 0;
};

const getSavedBindings = (): KeyboardBindings => {
  if (typeof window === 'undefined') return DEFAULT_BINDINGS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY_BINDINGS_STORAGE_KEY) || 'null') as Partial<KeyboardBindings> | null;
    if (!saved) return DEFAULT_BINDINGS;
    const bindingsAreComplete = KEYBOARD_ACTIONS.every((action) => (
      typeof saved[action]?.code === 'string' && typeof saved[action]?.label === 'string'
    ));
    const codes = bindingsAreComplete ? KEYBOARD_ACTIONS.map((action) => saved[action]!.code!) : [];
    return bindingsAreComplete && new Set(codes).size === KEYBOARD_ACTIONS.length
      ? saved as KeyboardBindings
      : DEFAULT_BINDINGS;
  } catch {
    return DEFAULT_BINDINGS;
  }
};

const keyLabelFromEvent = (event: KeyboardEvent) => {
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

const initialGame = (mode: GameMode = 'solo'): GameState => ({
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
  best: getSavedBest(mode),
  meter: 0,
  next: { 1: 'T', 2: 'L' },
  playerStats: {
    1: { score: 0, lines: 0, combo: -1 },
    2: { score: 0, lines: 0, combo: -1 },
  },
  winner: null,
  message: 'Ready to stack',
});

const initialCoop = (): CoopState => ({
  phase: 'idle',
  roomCode: '',
  playerId: null,
  error: '',
});

const isGameState = (value: unknown): value is GameState => {
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

const getSavedMultiplayerSession = (): SavedMultiplayerSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(MULTIPLAYER_SESSION_STORAGE_KEY) || 'null') as SavedMultiplayerSession | null;
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

const persistMultiplayerSession = (session: SavedMultiplayerSession) => {
  window.sessionStorage.setItem(MULTIPLAYER_SESSION_STORAGE_KEY, JSON.stringify(session));
};

const clearMultiplayerSession = () => {
  window.sessionStorage.removeItem(MULTIPLAYER_SESSION_STORAGE_KEY);
};

function MiniPiece({ type, player }: { type: PieceName; player: PlayerId }) {
  const occupied = new Set(
    getCells({ type, player, rotation: 0, x: 0, y: 0 }).map(({ x, y }) => `${x}:${y}`),
  );

  return (
    <div className="grid h-16 w-16 grid-cols-4 grid-rows-4 gap-0.5" aria-label={`Next piece: ${type}`}>
      {Array.from({ length: 16 }, (_, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        const filled = occupied.has(`${x}:${y}`);
        return (
          <span
            key={index}
            className="rounded-[2px]"
            style={filled ? { background: PIECE_COLORS[type], boxShadow: `inset 0 0 0 1px ${PLAYER_COLORS[player]}` } : undefined}
          />
        );
      })}
    </div>
  );
}

function ControlPad({ player, onAction }: { player: PlayerId; onAction: (player: PlayerId, action: Action) => void }) {
  const buttonClass = 'select-none rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-lg text-white active:scale-95 active:bg-white/20';
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Player ${player} touch controls`}>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'left')} aria-label={`Player ${player} move left`}>←</button>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'rotate')} aria-label={`Player ${player} rotate`}>↻</button>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'down')} aria-label={`Player ${player} move down`}>↓</button>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'right')} aria-label={`Player ${player} move right`}>→</button>
      <button className={`${buttonClass} text-xs`} onPointerDown={() => onAction(player, 'drop')} aria-label={`Player ${player} hard drop`}>DROP</button>
    </div>
  );
}

type RenderedCell = { cell: Cell; ghost?: boolean; active?: boolean };

function BoardGrid({
  cells,
  cols,
  width,
  accent,
  label,
}: {
  cells: Map<string, RenderedCell>;
  cols: number;
  width: string;
  accent: string;
  label: string;
}) {
  return (
    <div>
      {label && <p className="mb-2 text-center text-[9px]" style={{ color: accent }}>{label}</p>}
      <div
        className="grid overflow-hidden rounded-xl border-2 bg-[#020704] p-1 shadow-[0_0_60px_rgba(118,255,76,0.08)]"
        style={{
          width,
          aspectRatio: `${cols} / ${ROWS}`,
          borderColor: `${accent}55`,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          gap: '1px',
        }}
      >
        {Array.from({ length: ROWS * cols }, (_, index) => {
          const x = index % cols;
          const y = Math.floor(index / cols);
          const rendered = cells.get(`${x}:${y}`);
          const color = rendered ? PIECE_COLORS[rendered.cell.type] : undefined;
          const ownerColor = rendered ? PLAYER_COLORS[rendered.cell.owner] : undefined;
          return (
            <span
              key={index}
              className="rounded-[2px] bg-white/[0.025]"
              style={rendered ? {
                background: rendered.ghost ? `${color}1f` : color,
                border: rendered.ghost ? `1px solid ${color}65` : undefined,
                boxShadow: rendered.active ? `inset 0 0 0 2px ${ownerColor}, inset 2px 2px 0 rgba(255,255,255,.3)` : `inset 0 0 0 1px ${ownerColor}90, inset 2px 2px 0 rgba(255,255,255,.18)`,
                opacity: rendered.ghost ? 0.8 : 1,
              } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function TetrisGame() {
  const [game, setGame] = useState<GameState>(initialGame);
  const [coop, setCoop] = useState<CoopState>(initialCoop);
  const [joinCode, setJoinCode] = useState('');
  const [keyBindings, setKeyBindings] = useState<KeyboardBindings>(getSavedBindings);
  const [bindingAction, setBindingAction] = useState<KeyboardAction | null>(null);
  const gameRef = useRef(game);
  const bagRef = useRef<PieceName[]>([]);
  const duelSequenceRef = useRef<PieceName[]>([]);
  const duelDrawIndexRef = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const socketRef = useRef<WebSocket | null>(null);
  const localPlayerRef = useRef<PlayerId | null>(null);
  const multiplayerSessionRef = useRef<SavedMultiplayerSession | null>(getSavedMultiplayerSession());
  const intentionalCloseRef = useRef(false);
  const socketMessageHandlerRef = useRef<(message: Record<string, unknown>) => void>(() => undefined);

  const sendSocketMessage = useCallback((message: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const publish = useCallback((nextGame: GameState, sync = true) => {
    gameRef.current = nextGame;
    setGame(nextGame);
    if (nextGame.mode !== 'solo' && multiplayerSessionRef.current) {
      multiplayerSessionRef.current = {
        ...multiplayerSessionRef.current,
        game: nextGame,
        bag: [...bagRef.current],
        duelSequence: [...duelSequenceRef.current],
        duelDrawIndex: { ...duelDrawIndexRef.current },
      };
      persistMultiplayerSession(multiplayerSessionRef.current);
    }
    if (sync && nextGame.mode !== 'solo' && localPlayerRef.current === 1) {
      sendSocketMessage({ type: 'state', state: nextGame });
    }
  }, [sendSocketMessage]);

  const captureBinding = useCallback((action: KeyboardAction, event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setBindingAction(null);
      return;
    }
    if (event.key === 'Tab') return;
    event.preventDefault();
    event.stopPropagation();

    const replacement = { code: event.code, label: keyLabelFromEvent(event) };
    setKeyBindings((current) => {
      const duplicateAction = KEYBOARD_ACTIONS.find((candidate) => (
        candidate !== action && current[candidate].code === replacement.code
      ));
      const next = { ...current, [action]: replacement };
      if (duplicateAction) next[duplicateAction] = current[action];
      window.localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setBindingAction(null);
  }, []);

  const resetBindings = useCallback(() => {
    const defaults = Object.fromEntries(
      KEYBOARD_ACTIONS.map((action) => [action, { ...DEFAULT_BINDINGS[action] }]),
    ) as KeyboardBindings;
    setKeyBindings(defaults);
    setBindingAction(null);
    window.localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(defaults));
  }, []);

  const drawType = useCallback(() => {
    if (bagRef.current.length === 0) {
      const bag = [...PIECES];
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
      }
      bagRef.current = bag;
    }
    return bagRef.current.pop() as PieceName;
  }, []);

  const drawDuelType = useCallback((player: PlayerId) => {
    const index = duelDrawIndexRef.current[player];
    if (index >= duelSequenceRef.current.length) {
      const bag = [...PIECES];
      for (let bagIndex = bag.length - 1; bagIndex > 0; bagIndex -= 1) {
        const swapIndex = Math.floor(Math.random() * (bagIndex + 1));
        [bag[bagIndex], bag[swapIndex]] = [bag[swapIndex], bag[bagIndex]];
      }
      duelSequenceRef.current.push(...bag);
    }
    duelDrawIndexRef.current[player] += 1;
    return duelSequenceRef.current[index];
  }, []);

  const endGame = useCallback((data: GameState, loser?: PlayerId) => {
    const best = Math.max(data.best, data.score);
    const key = data.mode === 'coop'
      ? 'shkermitStacksCoopBest'
      : data.mode === 'duel' ? 'shkermitStacksDuelBest' : 'shkermitStacksBest';
    window.localStorage.setItem(key, String(best));
    if (data.mode === 'duel' && loser) {
      const winner: PlayerId = loser === 1 ? 2 : 1;
      publish({ ...data, status: 'gameover', best, winner, message: `PLAYER ${winner} WINS THE DUEL!` });
      return;
    }
    publish({ ...data, status: 'gameover', best, message: 'The stack got the crew' });
  }, [publish]);

  const startGame = useCallback((mode: GameMode = gameRef.current.mode) => {
    bagRef.current = [];
    duelSequenceRef.current = [];
    duelDrawIndexRef.current = { 1: 0, 2: 0 };
    const cols = mode === 'coop' ? COOP_COLS : SOLO_COLS;
    const firstOne = mode === 'duel' ? drawDuelType(1) : drawType();
    const nextOne = mode === 'duel' ? drawDuelType(1) : drawType();
    const firstTwo: PieceName = mode === 'duel' ? drawDuelType(2) : mode === 'coop' ? drawType() : 'O';
    const nextTwo: PieceName = mode === 'duel' ? drawDuelType(2) : mode === 'coop' ? drawType() : 'O';
    const active = [spawnPiece(firstOne, 1, cols, mode)];
    if (mode !== 'solo') active.push(spawnPiece(firstTwo, 2, cols, mode));

    publish({
      mode,
      board: makeBoard(cols),
      duelBoards: mode === 'duel' ? { 1: makeBoard(cols), 2: makeBoard(cols) } : null,
      active,
      status: 'playing',
      cols,
      score: 0,
      lines: 0,
      level: 1,
      combo: -1,
      best: getSavedBest(mode),
      meter: 0,
      next: { 1: nextOne, 2: nextTwo },
      playerStats: {
        1: { score: 0, lines: 0, combo: -1 },
        2: { score: 0, lines: 0, combo: -1 },
      },
      winner: null,
      message: mode === 'coop'
        ? 'Two frogs. One stack. Work together!'
        : mode === 'duel' ? 'Clear lines to attack your rival!' : 'Stack steady.',
    });
  }, [drawDuelType, drawType, publish]);

  const lockPiece = useCallback((source: GameState, player: PlayerId) => {
    const piece = source.active.find((item) => item.player === player);
    if (!piece) return;

    if (getCells(piece).some(({ y }) => y < 0)) {
      endGame(source, player);
      return;
    }

    let board = getPlayerBoard(source, player).map((row) => [...row]);
    getCells(piece).forEach(({ x, y }) => {
      board[y][x] = { type: piece.type, owner: player };
    });

    const fullRows: number[] = [];
    board.forEach((row, rowIndex) => {
      if (row.every(Boolean)) fullRows.push(rowIndex);
    });
    board = board.filter((_, rowIndex) => !fullRows.includes(rowIndex));
    while (board.length < ROWS) board.unshift(Array<Cell | null>(source.cols).fill(null));

    let active = source.active.filter((item) => item.player !== player);
    if (fullRows.length && source.mode !== 'duel') {
      active = active.map((item) => {
        const lowestCell = Math.max(...getCells(item).map(({ y }) => y));
        const shift = fullRows.filter((row) => row > lowestCell).length;
        return shift ? { ...item, y: item.y + shift } : item;
      });
    }

    const previousCombo = source.mode === 'duel' ? source.playerStats[player].combo : source.combo;
    const combo = fullRows.length ? previousCombo + 1 : -1;
    const scoreTable = [0, 100, 300, 500, 800];
    const gained = Math.round(((scoreTable[fullRows.length] || fullRows.length * 250) + Math.max(0, combo) * 50) * source.level);
    const playerLines = source.playerStats[player].lines + fullRows.length;
    const nextType = source.next[player];
    const spawned = spawnPiece(nextType, player, source.cols, source.mode);
    const next = { ...source.next, [player]: source.mode === 'duel' ? drawDuelType(player) : drawType() };
    const playerStats = {
      ...source.playerStats,
      [player]: {
        score: source.playerStats[player].score + gained,
        lines: playerLines,
        combo,
      },
    };
    let duelBoards = source.duelBoards;
    if (source.mode === 'duel') duelBoards = { ...source.duelBoards!, [player]: board };

    const data: GameState = {
      ...source,
      board: source.mode === 'duel' ? source.board : board,
      duelBoards,
      active,
      next,
      score: source.score + gained,
      lines: source.lines + fullRows.length,
      level: source.mode === 'duel'
        ? Math.floor(Math.max(playerStats[1].lines, playerStats[2].lines) / 10) + 1
        : Math.floor((source.lines + fullRows.length) / 10) + 1,
      combo,
      meter: source.mode === 'duel' ? 0 : Math.min(100, source.meter + fullRows.length * 18),
      playerStats,
      message: source.mode === 'duel' && fullRows.length >= 2
        ? `PLAYER ${player} ATTACKS!`
        : fullRows.length >= 4
        ? 'SHKERMIT! Four-line clear!'
        : fullRows.length > 0
          ? `${fullRows.length} line${fullRows.length > 1 ? 's' : ''} cleared${combo > 0 ? ` • ${combo + 1}x combo` : ''}`
          : source.message,
    };

    if (source.mode === 'duel') {
      const attackRows = [0, 0, 1, 2, 4][fullRows.length] || Math.max(0, fullRows.length - 1);
      if (attackRows > 0) {
        const opponent: PlayerId = player === 1 ? 2 : 1;
        const opponentBoard = data.duelBoards![opponent];
        const overflow = opponentBoard.slice(0, attackRows).some((row) => row.some(Boolean));
        const garbageRows = Array.from({ length: attackRows }, () => {
          const hole = Math.floor(Math.random() * source.cols);
          return Array.from({ length: source.cols }, (_, x): Cell | null => (
            x === hole ? null : { type: 'G', owner: player }
          ));
        });
        data.duelBoards = {
          ...data.duelBoards!,
          [opponent]: [...opponentBoard.slice(attackRows), ...garbageRows],
        };
        data.active = data.active.map((item) => item.player === opponent
          ? { ...item, y: item.y - attackRows }
          : item);
        data.message = `PLAYER ${player} SENT ${attackRows} GARBAGE ROW${attackRows > 1 ? 'S' : ''}!`;
        if (overflow) {
          endGame(data, opponent);
          return;
        }
      }
    }

    const collisionPieces = source.mode === 'duel' ? [] : data.active;
    if (!isValid(spawned, board, collisionPieces, source.cols)) {
      endGame(data, player);
      return;
    }

    data.active = [...data.active, spawned];
    if (data.meter >= 100) data.message = 'FROG FLUSH READY';
    publish(data);
  }, [drawDuelType, drawType, endGame, publish]);

  const movePlayer = useCallback((player: PlayerId, action: Action) => {
    const source = gameRef.current;
    if (source.status !== 'playing') return;
    const piece = source.active.find((item) => item.player === player);
    if (!piece) return;
    const board = getPlayerBoard(source, player);
    const collisionPieces = getCollidingPieces(source, player);

    if (action === 'drop') {
      let dropped = { ...piece };
      let distance = 0;
      while (isValid({ ...dropped, y: dropped.y + 1 }, board, collisionPieces, source.cols)) {
        dropped = { ...dropped, y: dropped.y + 1 };
        distance += 1;
      }
      const active = source.active.map((item) => item.player === player ? dropped : item);
      const playerStats = source.mode === 'duel' ? {
        ...source.playerStats,
        [player]: { ...source.playerStats[player], score: source.playerStats[player].score + distance * 2 },
      } : source.playerStats;
      lockPiece({ ...source, active, score: source.score + distance * 2, playerStats }, player);
      return;
    }

    if (action === 'rotate') {
      const rotated = { ...piece, rotation: (piece.rotation + 1) % 4 };
      const kicks = [0, -1, 1, -2, 2];
      const kicked = kicks
        .map((offset) => ({ ...rotated, x: rotated.x + offset }))
        .find((candidate) => isValid(candidate, board, collisionPieces, source.cols));
      if (kicked) publish({ ...source, active: source.active.map((item) => item.player === player ? kicked : item) });
      return;
    }

    const dx = action === 'left' ? -1 : action === 'right' ? 1 : 0;
    const dy = action === 'down' ? 1 : 0;
    const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
    if (isValid(moved, board, collisionPieces, source.cols)) {
      const playerStats = source.mode === 'duel' && action === 'down' ? {
        ...source.playerStats,
        [player]: { ...source.playerStats[player], score: source.playerStats[player].score + 1 },
      } : source.playerStats;
      publish({
        ...source,
        active: source.active.map((item) => item.player === player ? moved : item),
        score: source.score + (action === 'down' ? 1 : 0),
        playerStats,
      });
    } else if (action === 'down') {
      lockPiece(source, player);
    }
  }, [lockPiece, publish]);

  const activateFrogFlush = useCallback(() => {
    const source = gameRef.current;
    if (source.status !== 'playing' || source.mode === 'duel' || source.meter < 100) return;
    const occupiedRows = source.board
      .map((row, index) => ({ index, occupied: row.some(Boolean) }))
      .filter(({ occupied }) => occupied)
      .map(({ index }) => index)
      .slice(-2);

    if (!occupiedRows.length) return;
    const board = source.board.filter((_, index) => !occupiedRows.includes(index));
    while (board.length < ROWS) board.unshift(Array<Cell | null>(source.cols).fill(null));
    const active = source.active.map((piece) => {
      const lowestCell = Math.max(...getCells(piece).map(({ y }) => y));
      const shift = occupiedRows.filter((row) => row > lowestCell).length;
      return shift ? { ...piece, y: piece.y + shift } : piece;
    });
    publish({
      ...source,
      board,
      active,
      meter: 0,
      score: source.score + occupiedRows.length * 250 * source.level,
      message: `FROG FLUSH! ${occupiedRows.length} danger row${occupiedRows.length > 1 ? 's' : ''} gone.`,
    });
  }, [publish]);

  const togglePause = useCallback(() => {
    const source = gameRef.current;
    if (source.status === 'playing') publish({ ...source, status: 'paused', message: 'Stack break' });
    if (source.status === 'paused') publish({ ...source, status: 'playing', message: 'Back in the pond' });
  }, [publish]);

  const closeCoopSocket = useCallback((notifyServer = false) => {
    intentionalCloseRef.current = true;
    const socket = socketRef.current;
    socketRef.current = null;
    localPlayerRef.current = null;
    if (socket && socket.readyState === WebSocket.OPEN && notifyServer) {
      socket.send(JSON.stringify({ type: 'leave' }));
    }
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Left the room');
  }, []);

  const connectToCoop = useCallback((
    kind: 'create' | 'join' | 'resume',
    roomCode = '',
    gameMode: 'coop' | 'duel' = 'coop',
    resumeToken = '',
    restoredGame?: GameState,
  ) => {
    closeCoopSocket(kind !== 'resume');
    if (kind !== 'resume') {
      multiplayerSessionRef.current = null;
      clearMultiplayerSession();
    }
    intentionalCloseRef.current = false;
    const nextGame = restoredGame && isGameState(restoredGame) ? restoredGame : initialGame(gameMode);
    gameRef.current = nextGame;
    setGame(nextGame);
    setCoop({
      phase: 'connecting',
      roomCode,
      playerId: kind === 'resume' ? multiplayerSessionRef.current?.playerId || null : null,
      error: kind === 'resume' ? 'Restoring your board…' : '',
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/tetris`);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      const message = kind === 'create'
        ? { type: 'create', gameMode }
        : kind === 'resume' ? { type: 'resume', roomCode, resumeToken } : { type: 'join', roomCode };
      socket.send(JSON.stringify(message));
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Record<string, unknown>;
        socketMessageHandlerRef.current(message);
      } catch {
        setCoop((current) => ({ ...current, phase: 'error', error: 'The pond sent an unreadable message.' }));
      }
    });
    socket.addEventListener('error', () => {
      setCoop((current) => ({ ...current, phase: 'error', error: 'Could not reach the multiplayer pond.' }));
    });
    socket.addEventListener('close', () => {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      if (!intentionalCloseRef.current) {
        setCoop((current) => current.phase === 'error' ? current : {
          ...current,
          phase: 'error',
          error: 'The multiplayer connection closed.',
        });
      }
    });
  }, [closeCoopSocket]);

  const leaveCoop = useCallback(() => {
    closeCoopSocket(true);
    multiplayerSessionRef.current = null;
    clearMultiplayerSession();
    const nextGame = initialGame('solo');
    gameRef.current = nextGame;
    setGame(nextGame);
    setCoop(initialCoop());
    setJoinCode('');
  }, [closeCoopSocket]);

  const sendAction = useCallback((player: PlayerId, action: Action) => {
    const source = gameRef.current;
    if (source.mode === 'solo') {
      movePlayer(1, action);
      return;
    }
    if (localPlayerRef.current !== player) return;
    sendSocketMessage({ type: 'action', action });
  }, [movePlayer, sendSocketMessage]);

  const sendCommand = useCallback((command: GameCommand) => {
    if (gameRef.current.mode === 'solo') {
      if (command === 'toggle_pause') togglePause();
      if (command === 'restart') startGame('solo');
      if (command === 'frog_flush') activateFrogFlush();
      return;
    }
    sendSocketMessage({ type: 'command', command });
  }, [activateFrogFlush, sendSocketMessage, startGame, togglePause]);

  useEffect(() => {
    socketMessageHandlerRef.current = (message) => {
      if (message.type === 'room_created'
        && typeof message.roomCode === 'string'
        && typeof message.resumeToken === 'string') {
        const gameMode: 'coop' | 'duel' = message.gameMode === 'duel' ? 'duel' : 'coop';
        localPlayerRef.current = 1;
        multiplayerSessionRef.current = {
          roomCode: message.roomCode,
          playerId: 1,
          resumeToken: message.resumeToken,
          gameMode,
          game: gameRef.current,
        };
        persistMultiplayerSession(multiplayerSessionRef.current);
        setCoop({ phase: 'hosting', roomCode: message.roomCode, playerId: 1, error: '' });
        return;
      }
      if (message.type === 'room_joined'
        && typeof message.roomCode === 'string'
        && typeof message.resumeToken === 'string') {
        const gameMode: 'coop' | 'duel' = message.gameMode === 'duel' ? 'duel' : 'coop';
        const nextGame = initialGame(gameMode);
        gameRef.current = nextGame;
        setGame(nextGame);
        localPlayerRef.current = 2;
        multiplayerSessionRef.current = {
          roomCode: message.roomCode,
          playerId: 2,
          resumeToken: message.resumeToken,
          gameMode,
          game: nextGame,
        };
        persistMultiplayerSession(multiplayerSessionRef.current);
        setCoop({ phase: 'connected', roomCode: message.roomCode, playerId: 2, error: '' });
        return;
      }
      if (message.type === 'room_resumed'
        && typeof message.roomCode === 'string'
        && typeof message.resumeToken === 'string'
        && (message.playerId === 1 || message.playerId === 2)) {
        const gameMode: 'coop' | 'duel' = message.gameMode === 'duel' ? 'duel' : 'coop';
        const playerId = message.playerId;
        localPlayerRef.current = playerId;
        const saved = multiplayerSessionRef.current;
        if (playerId === 1 && saved) {
          bagRef.current = [...(saved.bag || [])];
          duelSequenceRef.current = [...(saved.duelSequence || [])];
          duelDrawIndexRef.current = saved.duelDrawIndex ? { ...saved.duelDrawIndex } : { 1: 0, 2: 0 };
        }
        const restoredState = isGameState(message.state)
          ? message.state
          : saved?.game && isGameState(saved.game) ? saved.game : initialGame(gameMode);
        const peerConnected = message.peerConnected === true;
        const resumedState = !peerConnected && restoredState.status === 'playing'
          ? { ...restoredState, status: 'paused' as const, message: 'Waiting for the other player to reconnect' }
          : restoredState;
        multiplayerSessionRef.current = {
          ...saved,
          roomCode: message.roomCode,
          playerId,
          resumeToken: message.resumeToken,
          gameMode,
          game: resumedState,
        };
        persistMultiplayerSession(multiplayerSessionRef.current);
        setCoop({
          phase: playerId === 1 && !peerConnected ? 'hosting' : 'connected',
          roomCode: message.roomCode,
          playerId,
          error: peerConnected ? '' : 'Your game was restored. Waiting for the other player to reconnect.',
        });
        publish(resumedState, playerId === 1);
        return;
      }
      if (message.type === 'peer_joined' && localPlayerRef.current === 1) {
        setCoop((current) => ({ ...current, phase: 'connected', error: '' }));
        startGame(gameRef.current.mode === 'duel' ? 'duel' : 'coop');
        return;
      }
      if (message.type === 'player_action' && localPlayerRef.current === 1) {
        if ((message.playerId === 1 || message.playerId === 2)
          && typeof message.action === 'string'
          && ['left', 'right', 'rotate', 'down', 'drop'].includes(message.action)) {
          movePlayer(message.playerId, message.action as Action);
        }
        return;
      }
      if (message.type === 'game_command' && localPlayerRef.current === 1) {
        if (message.command === 'toggle_pause') togglePause();
        if (message.command === 'restart') startGame(gameRef.current.mode === 'duel' ? 'duel' : 'coop');
        if (message.command === 'frog_flush') activateFrogFlush();
        return;
      }
      if (message.type === 'game_state' && localPlayerRef.current === 2 && isGameState(message.state)) {
        publish(message.state, false);
        return;
      }
      if (message.type === 'peer_left' && localPlayerRef.current) {
        const source = gameRef.current;
        const peerName = source.mode === 'duel' ? 'rival' : 'partner';
        const reconnecting = message.reconnecting !== false;
        setCoop((current) => ({
          ...current,
          phase: localPlayerRef.current === 1 ? 'hosting' : 'connected',
          error: reconnecting
            ? `Your ${peerName} refreshed or disconnected. Waiting for them to return.`
            : `Your ${peerName} left the room.`,
        }));
        publish({
          ...source,
          status: source.status === 'gameover' ? 'gameover' : 'paused',
          message: `${peerName === 'rival' ? 'Rival' : 'Partner'} disconnected — board preserved`,
        }, localPlayerRef.current === 1);
        return;
      }
      if (message.type === 'peer_rejoined') {
        setCoop((current) => ({ ...current, phase: 'connected', error: '' }));
        const source = gameRef.current;
        publish({ ...source, message: 'Player reconnected — resume when ready' }, localPlayerRef.current === 1);
        return;
      }
      if (message.type === 'peer_expired') {
        setCoop((current) => ({ ...current, phase: 'hosting', error: 'Player 2 did not reconnect. The room is open for a new player.' }));
        return;
      }
      if (message.type === 'room_closed') {
        closeCoopSocket();
        multiplayerSessionRef.current = null;
        clearMultiplayerSession();
        const nextGame = initialGame(gameRef.current.mode === 'duel' ? 'duel' : 'coop');
        gameRef.current = nextGame;
        setGame(nextGame);
        setCoop((current) => ({
          ...current,
          phase: 'error',
          playerId: null,
          error: typeof message.reason === 'string' ? message.reason : 'The host closed the room.',
        }));
        return;
      }
      if (message.type === 'resume_rejected') {
        closeCoopSocket();
        multiplayerSessionRef.current = null;
        clearMultiplayerSession();
        const nextGame = initialGame('solo');
        gameRef.current = nextGame;
        setGame(nextGame);
        setCoop({
          phase: 'error',
          roomCode: '',
          playerId: null,
          error: typeof message.message === 'string' ? message.message : 'That saved room has expired.',
        });
        return;
      }
      if (message.type === 'error') {
        setCoop((current) => ({
          ...current,
          phase: 'error',
          error: typeof message.message === 'string' ? message.message : 'Multiplayer could not start.',
        }));
      }
    };
  }, [activateFrogFlush, closeCoopSocket, movePlayer, publish, startGame, togglePause]);

  useEffect(() => {
    if (!bindingAction) return;
    const onBindingKeyDown = (event: KeyboardEvent) => captureBinding(bindingAction, event);
    window.addEventListener('keydown', onBindingKeyDown, true);
    return () => window.removeEventListener('keydown', onBindingKeyDown, true);
  }, [bindingAction, captureBinding]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      const action = KEYBOARD_ACTIONS.find((candidate) => keyBindings[candidate].code === event.code);
      if (!action) return;
      event.preventDefault();

      if (action === 'pause' && !event.repeat) return sendCommand('toggle_pause');
      if (action === 'restart' && !event.repeat && gameRef.current.status !== 'ready') return sendCommand('restart');
      if (action === 'frogFlush' && !event.repeat) return sendCommand('frog_flush');
      if (gameRef.current.status !== 'playing' || action === 'restart') return;

      const source = gameRef.current;
      const player = source.mode !== 'solo' ? localPlayerRef.current : 1;
      if (player && !(event.repeat && (action === 'drop' || action === 'rotate'))) {
        sendAction(player, action as Action);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keyBindings, sendAction, sendCommand]);

  useEffect(() => {
    if (game.status !== 'playing') return;
    if (game.mode !== 'solo' && localPlayerRef.current !== 1) return;
    const speed = Math.max(120, 820 - (game.level - 1) * 60);
    const timer = window.setInterval(() => {
      const players = [...gameRef.current.active]
        .sort((a, b) => Math.max(...getCells(b).map(({ y }) => y)) - Math.max(...getCells(a).map(({ y }) => y)))
        .map(({ player }) => player);
      players.forEach((player) => movePlayer(player, 'down'));
    }, speed);
    return () => window.clearInterval(timer);
  }, [game.level, game.mode, game.status, movePlayer]);

  useEffect(() => {
    const saved = multiplayerSessionRef.current;
    if (!saved) return;
    connectToCoop('resume', saved.roomCode, saved.gameMode, saved.resumeToken, saved.game);
  }, [connectToCoop]);

  useEffect(() => () => closeCoopSocket(), [closeCoopSocket]);

  const renderedBoards = useMemo(() => {
    const result = {} as Record<PlayerId, Map<string, { cell: Cell; ghost?: boolean; active?: boolean }>>;
    const players: PlayerId[] = game.mode === 'duel' ? [1, 2] : [1];
    players.forEach((player) => {
      const cells = new Map<string, { cell: Cell; ghost?: boolean; active?: boolean }>();
      const board = getPlayerBoard(game, player);
      const pieces = game.mode === 'duel'
        ? game.active.filter((piece) => piece.player === player)
        : game.active;
      board.forEach((row, y) => row.forEach((cell, x) => {
        if (cell) cells.set(`${x}:${y}`, { cell });
      }));
      pieces.forEach((piece) => {
        getCells(getGhost(piece, board, pieces, game.cols)).forEach(({ x, y }) => {
          if (y >= 0 && !cells.has(`${x}:${y}`)) cells.set(`${x}:${y}`, { cell: { type: piece.type, owner: piece.player }, ghost: true });
        });
      });
      pieces.forEach((piece) => {
        getCells(piece).forEach(({ x, y }) => {
          if (y >= 0) cells.set(`${x}:${y}`, { cell: { type: piece.type, owner: piece.player }, active: true });
        });
      });
      result[player] = cells;
    });
    if (!result[2]) result[2] = new Map();
    return result;
  }, [game]);

  if (game.status === 'ready') {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#061008] px-4 py-10 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(151,255,99,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(151,255,99,.05) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
        <img src={shkermitImage} alt="" className="pointer-events-none absolute -bottom-20 -right-24 w-[440px] opacity-15 grayscale" />
        <section className="relative mx-auto max-w-6xl">
          <a href="/games" className="mb-10 inline-flex items-center gap-2 text-xs text-lime-200/60 transition hover:text-lime-200">← BACK TO THE ARCADE</a>
          <div className="mb-12 max-w-3xl">
            <p className="mb-4 text-xs tracking-[0.35em] text-lime-300">SHKERMIT ARCADE / 03</p>
            <h1 className="text-5xl leading-[0.9] text-white sm:text-7xl">SHKERMIT<br /><span className="text-lime-300">STACKS</span></h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/55 sm:text-base">Classic falling blocks, remixed for the pond. Clear lines, build combos, and charge Shkermit's emergency Frog Flush.</p>
          </div>

          <div className="grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => {
                closeCoopSocket(true);
                multiplayerSessionRef.current = null;
                clearMultiplayerSession();
                setCoop(initialCoop());
                startGame('solo');
              }}
              className="group w-full rounded-2xl border border-lime-300/25 bg-lime-300/[0.06] p-7 text-left transition hover:-translate-y-1 hover:border-lime-300/60 hover:bg-lime-300/[0.1]"
            >
              <div className="mb-10 flex items-start justify-between"><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-white/50">1 PLAYER</span><span className="text-3xl transition group-hover:rotate-6">▦</span></div>
              <h2 className="text-2xl text-lime-200">SOLO STACK</h2>
              <p className="mt-3 text-xs leading-6 text-white/45">The familiar 10 × 20 board. Chase your best score and charge the Frog Flush.</p>
            </button>

            <div className="rounded-2xl border border-pink-300/25 bg-pink-300/[0.055] p-7">
              <div className="mb-7 flex items-start justify-between"><span className="rounded-full border border-pink-200/20 px-3 py-1 text-[10px] text-pink-100/70">2 PLAYERS · ONLINE</span><span className="text-3xl">▦▦</span></div>
              <h2 className="text-2xl text-pink-200">POND PAIR</h2>
              <p className="mt-3 text-xs leading-6 text-white/45">Share a wider board in real time. Each frog controls one piece; both share every clear, combo, and close call.</p>

              {(coop.phase === 'idle' || coop.phase === 'error') && (
                <div className="mt-6 space-y-3">
                  {coop.error && <p role="alert" className="rounded-lg border border-red-300/20 bg-red-400/10 p-3 text-[10px] leading-5 text-red-100">{coop.error}</p>}
                  <button onClick={() => connectToCoop('create', '', 'coop')} className="w-full rounded-lg bg-pink-200 px-4 py-3 text-[10px] text-[#1b0715] transition hover:bg-pink-100">CREATE A CO-OP POND</button>
                  <div className="flex gap-2">
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && joinCode.length === 5) connectToCoop('join', joinCode);
                      }}
                      maxLength={5}
                      aria-label="Multiplayer room code"
                      placeholder="ROOM CODE"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-center text-sm uppercase tracking-[0.25em] text-white outline-none focus:border-pink-200/60"
                    />
                    <button disabled={joinCode.length !== 5} onClick={() => connectToCoop('join', joinCode)} className="rounded-lg border border-pink-200/30 px-4 py-3 text-[10px] text-pink-100 disabled:cursor-not-allowed disabled:opacity-35">JOIN</button>
                  </div>
                </div>
              )}

              {coop.phase === 'connecting' && game.mode !== 'duel' && <p className="mt-6 animate-pulse text-[10px] text-pink-100/70">OPENING THE POND…</p>}

              {coop.phase === 'hosting' && game.mode === 'coop' && (
                <div className="mt-6 rounded-xl border border-pink-200/20 bg-black/25 p-4 text-center">
                  <p className="text-[9px] text-white/40">SHARE THIS POND CODE</p>
                  <p className="mt-2 text-3xl tracking-[0.22em] text-pink-100">{coop.roomCode}</p>
                  <p className="mt-3 animate-pulse text-[9px] text-white/45">WAITING FOR PLAYER 2…</p>
                  <div className="mt-4 flex justify-center gap-4 text-[9px]">
                    <button onClick={() => void navigator.clipboard?.writeText(coop.roomCode)} className="text-pink-100/70 underline">COPY CODE</button>
                    <button onClick={leaveCoop} className="text-white/35 underline">CANCEL</button>
                  </div>
                </div>
              )}

              {coop.phase === 'connected' && game.mode === 'coop' && <p className="mt-6 animate-pulse text-[10px] text-pink-100/70">PARTNER FOUND · SYNCING THE STACK…</p>}
            </div>

            <div className="rounded-2xl border border-orange-300/25 bg-orange-300/[0.055] p-7">
              <div className="mb-7 flex items-start justify-between"><span className="rounded-full border border-orange-200/20 px-3 py-1 text-[10px] text-orange-100/70">2 PLAYERS · VERSUS</span><span className="text-3xl">▦⚔▦</span></div>
              <h2 className="text-2xl text-orange-200">SWAMP DUEL</h2>
              <p className="mt-3 text-xs leading-6 text-white/45">Race on separate boards. Clear 2, 3, or 4 lines to send 1, 2, or 4 garbage rows. First frog to top out loses.</p>

              {(coop.phase === 'idle' || coop.phase === 'error') && (
                <button onClick={() => connectToCoop('create', '', 'duel')} className="mt-6 w-full rounded-lg bg-orange-200 px-4 py-3 text-[10px] text-[#1b1007] transition hover:bg-orange-100">CREATE A DUEL</button>
              )}
              {coop.phase === 'connecting' && game.mode === 'duel' && <p className="mt-6 animate-pulse text-[10px] text-orange-100/70">OPENING THE ARENA…</p>}
              {coop.phase === 'hosting' && game.mode === 'duel' && (
                <div className="mt-6 rounded-xl border border-orange-200/20 bg-black/25 p-4 text-center">
                  <p className="text-[9px] text-white/40">SHARE THIS DUEL CODE</p>
                  <p className="mt-2 text-3xl tracking-[0.22em] text-orange-100">{coop.roomCode}</p>
                  <p className="mt-3 animate-pulse text-[9px] text-white/45">WAITING FOR YOUR RIVAL…</p>
                  <div className="mt-4 flex justify-center gap-4 text-[9px]">
                    <button onClick={() => void navigator.clipboard?.writeText(coop.roomCode)} className="text-orange-100/70 underline">COPY CODE</button>
                    <button onClick={leaveCoop} className="text-white/35 underline">CANCEL</button>
                  </div>
                </div>
              )}
              {coop.phase === 'connected' && game.mode === 'duel' && <p className="mt-6 animate-pulse text-[10px] text-orange-100/70">RIVAL FOUND · PREPARING THE ARENA…</p>}
            </div>
          </div>

          <section className="mt-5 max-w-6xl rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-7" aria-labelledby="keyboard-controls-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[9px] tracking-[0.22em] text-white/35">LOCAL SETTINGS</p>
                <h2 id="keyboard-controls-title" className="mt-2 text-lg text-white">YOUR KEYBOARD CONTROLS</h2>
                <p className="mt-2 max-w-xl text-[10px] leading-5 text-white/40">These keys control you in solo, co-op, and duels, whether you are Player 1 or Player 2. They are saved on this device.</p>
              </div>
              <button onClick={resetBindings} className="rounded-lg border border-white/10 px-3 py-2 text-[9px] text-white/40 transition hover:bg-white/8 hover:text-white/70">RESET DEFAULTS</button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {KEYBOARD_ACTIONS.map((action) => {
                const listening = bindingAction === action;
                return (
                  <div key={action} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/20 p-2 pl-3">
                    <span className="text-[9px] text-white/45">{KEYBOARD_ACTION_LABELS[action]}</span>
                    <button
                      onClick={() => setBindingAction(action)}
                      aria-label={listening ? `Press a key for ${KEYBOARD_ACTION_LABELS[action]}` : `Change ${KEYBOARD_ACTION_LABELS[action]} key`}
                      className={`min-w-14 rounded-md border px-2 py-2 text-[10px] transition ${listening ? 'animate-pulse border-lime-200 bg-lime-200 text-[#071008]' : 'border-lime-200/20 bg-lime-300/[0.06] text-lime-100 hover:border-lime-200/50'}`}
                    >
                      {listening ? 'PRESS…' : keyBindings[action].label}
                    </button>
                  </div>
                );
              })}
            </div>
            {bindingAction && <p className="mt-3 text-[9px] text-lime-100/55">Press any key for {KEYBOARD_ACTION_LABELS[bindingAction]}. Press Escape to cancel. If that key is already used, the two bindings will swap.</p>}
          </section>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[10px] text-white/35">
            <span>7-BAG RANDOMIZER</span><span>GHOST PIECES</span><span>REAL-TIME MULTIPLAYER</span><span>GARBAGE ATTACKS</span><span>CUSTOM KEYS</span><span>TOUCH READY</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061008] px-3 py-6 text-white sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(117,255,76,.16), transparent 38%)' }} />
      <div className="relative mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <a href="/games" className="mb-2 block text-[9px] tracking-[0.22em] text-white/35 hover:text-lime-200">← SHKERMIT ARCADE</a>
            <h1 className="text-2xl text-lime-300 sm:text-4xl">SHKERMIT STACKS</h1>
          </div>
          <div className="flex items-center gap-2 text-[9px]">
            <span className={`h-2 w-2 rounded-full ${game.status === 'playing' ? 'animate-pulse bg-lime-300' : 'bg-yellow-300'}`} />
            <span className="text-white/45">
              {game.mode === 'coop'
                ? `POND PAIR · P${coop.playerId} · ${coop.roomCode}`
                : game.mode === 'duel' ? `SWAMP DUEL · P${coop.playerId} · ${coop.roomCode}` : 'SOLO RUN'} · LVL {game.level}
            </span>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(320px,660px)_250px] xl:justify-center">
          <aside className="order-2 grid grid-cols-3 gap-3 xl:order-1 xl:grid-cols-1">
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">SCORE</p>
              <p className="mt-2 text-xl text-white sm:text-2xl">{(game.mode === 'duel' ? game.playerStats[coop.playerId || 1].score : game.score).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">{game.mode === 'duel' ? 'YOUR / RIVAL LINES' : 'LINES / BEST'}</p>
              <p className="mt-2 text-sm text-lime-200">
                {game.mode === 'duel'
                  ? <>{game.playerStats[coop.playerId || 1].lines} <span className="text-white/20">/</span> {game.playerStats[(coop.playerId || 1) === 1 ? 2 : 1].lines}</>
                  : <>{game.lines} <span className="text-white/20">/</span> {game.best.toLocaleString()}</>}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">COMBO</p>
              <p className="mt-2 text-sm text-pink-200">{(game.mode === 'duel' ? game.playerStats[coop.playerId || 1].combo : game.combo) > 0 ? `${(game.mode === 'duel' ? game.playerStats[coop.playerId || 1].combo : game.combo) + 1}×` : '—'}</p>
            </div>
            {game.mode === 'duel' ? (
              <div className="col-span-3 rounded-xl border border-orange-300/15 bg-orange-300/[0.04] p-4 xl:col-span-1">
                <p className="text-[9px] text-orange-200">GARBAGE ATTACKS</p>
                <p className="mt-3 text-[9px] leading-5 text-white/40">2 lines → 1 row<br />3 lines → 2 rows<br />4 lines → 4 rows</p>
              </div>
            ) : (
              <div className="col-span-3 rounded-xl border border-lime-300/15 bg-lime-300/[0.04] p-4 xl:col-span-1">
                <div className="mb-2 flex justify-between text-[9px]"><span className="text-lime-200">FROG FLUSH</span><span className="text-white/40">{game.meter}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-linear-to-r from-lime-500 to-yellow-200 transition-all" style={{ width: `${game.meter}%` }} /></div>
                <p className="mt-3 text-[9px] leading-4 text-white/35">Fill by clearing lines. Press <span className="text-white">{keyBindings.frogFlush.label}</span> at 100% to wash away two danger rows.</p>
              </div>
            )}
          </aside>

          <section className="order-1 flex flex-col items-center xl:order-2">
            <div className="mb-2 flex w-full items-center justify-between gap-3 text-[9px] text-white/35" style={{ maxWidth: game.mode === 'duel' ? 640 : game.mode === 'coop' ? 560 : 400 }}>
              <span className={game.mode === 'duel' ? 'text-orange-200' : game.mode === 'coop' ? 'text-pink-200' : 'text-lime-200'}>{game.mode === 'duel' ? 'DUEL' : game.mode === 'coop' ? 'CO-OP' : 'SOLO'}</span><span className="text-right">{game.message}</span><span />
            </div>
            <div className="relative">
              {game.mode === 'duel' ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  {([1, 2] as PlayerId[]).map((player) => (
                    <BoardGrid
                      key={player}
                      cells={renderedBoards[player]}
                      cols={game.cols}
                      width="min(44vw, 300px)"
                      accent={PLAYER_COLORS[player]}
                      label={`P${player}${coop.playerId === player ? ' · YOU' : ' · RIVAL'} · ${game.playerStats[player].score.toLocaleString()} PTS`}
                    />
                  ))}
                </div>
              ) : (
                <BoardGrid
                  cells={renderedBoards[1]}
                  cols={game.cols}
                  width={game.mode === 'coop' ? 'min(92vw, 560px)' : 'min(82vw, 400px)'}
                  accent="#b5ff4a"
                  label=""
                />
              )}
              {(game.status === 'paused' || game.status === 'gameover') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020704]/90 p-8 text-center backdrop-blur-sm">
                  <img src={shkermitImage} alt="Shkermit" className="mb-4 h-24 w-24 object-contain" />
                  <p className="text-[10px] tracking-[0.3em] text-lime-300">{game.status === 'paused' ? 'POND BREAK' : game.mode === 'duel' ? 'DUEL OVER' : 'STACK OVER'}</p>
                  <h2 className="mt-3 text-2xl">{game.status === 'paused' ? 'PAUSED' : game.mode === 'duel' ? `PLAYER ${game.winner} WINS` : `${game.score.toLocaleString()} PTS`}</h2>
                  <div className="mt-6 flex gap-2">
                    {game.status === 'paused' && <button onClick={() => sendCommand('toggle_pause')} className="rounded-lg bg-lime-300 px-4 py-3 text-[10px] text-[#061008]">KEEP STACKING</button>}
                    <button onClick={() => sendCommand('restart')} className="rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-[10px]">RESTART</button>
                  </div>
                  {game.status === 'gameover' && (
                    <button
                      onClick={() => {
                        if (game.mode !== 'solo') leaveCoop();
                        else publish({ ...initialGame('solo'), best: game.best });
                      }}
                      className="mt-4 text-[9px] text-white/40 underline"
                    >MAIN MENU</button>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="order-3 space-y-3">
            <div className="grid gap-3">
              {(game.mode !== 'solo' ? [1, 2] as PlayerId[] : [1] as PlayerId[]).map((player) => {
                const isLocalPlayer = game.mode === 'solo' || coop.playerId === player;
                return (
                  <div key={player} className="flex items-center justify-between rounded-xl border bg-white/[0.035] p-4" style={{ borderColor: `${PLAYER_COLORS[player]}33` }}>
                    <div>
                      <p className="text-[9px]" style={{ color: PLAYER_COLORS[player] }}>{game.mode !== 'solo' ? `PLAYER ${player}${isLocalPlayer ? ' · YOU' : ''}` : 'NEXT PIECE'}</p>
                      <p className="mt-2 text-[9px] leading-4 text-white/35">
                        {isLocalPlayer
                          ? <>{keyBindings.left.label} {keyBindings.right.label} move<br />{keyBindings.rotate.label} rotate · {keyBindings.drop.label} drop</>
                          : <>REMOTE PLAYER<br />USES THEIR OWN KEYS</>}
                      </p>
                    </div>
                    <MiniPiece type={game.next[player]} player={player} />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => sendCommand('toggle_pause')} className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-3 text-[9px] text-white/50 hover:bg-white/10">{game.status === 'paused' ? 'RESUME' : 'PAUSE'} · {keyBindings.pause.label}</button>
              <button onClick={() => sendCommand('restart')} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-[9px] text-white/50 hover:bg-white/10">↻</button>
              {game.mode !== 'solo' && <button onClick={leaveCoop} className="rounded-lg border border-pink-200/15 bg-pink-300/[0.04] px-3 py-3 text-[9px] text-pink-100/55">LEAVE</button>}
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-lime-300/10 bg-white/[0.025] p-3">
            <p className="mb-2 text-center text-[9px]" style={{ color: PLAYER_COLORS[game.mode !== 'solo' ? coop.playerId || 1 : 1] }}>
              {game.mode !== 'solo' ? `PLAYER ${coop.playerId} TOUCH CONTROLS` : 'TOUCH CONTROLS'}
            </p>
            <ControlPad player={game.mode !== 'solo' ? coop.playerId || 1 : 1} onAction={sendAction} />
          </div>
        </div>
      </div>
    </main>
  );
}
