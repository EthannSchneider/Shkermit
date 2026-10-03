import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import shkermitImage from '../../assets/img/3 TeteShkermit RTX.png';

type PieceName = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type PlayerId = 1;
type GameStatus = 'ready' | 'playing' | 'paused' | 'gameover';
type Action = 'left' | 'right' | 'rotate' | 'down' | 'drop';

type Cell = {
  type: PieceName;
  owner: PlayerId;
};

type ActivePiece = {
  type: PieceName;
  player: PlayerId;
  rotation: number;
  x: number;
  y: number;
};

type GameState = {
  board: (Cell | null)[][];
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
  message: string;
};

const ROWS = 20;
const SOLO_COLS = 10;
const PIECES: PieceName[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const BASE_SHAPES: Record<PieceName, string[]> = {
  I: ['....', '####', '....', '....'],
  O: ['##', '##'],
  T: ['.#.', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
};

const PIECE_COLORS: Record<PieceName, string> = {
  I: '#35d7ff',
  O: '#ffe44f',
  T: '#ba70ff',
  S: '#74e06f',
  Z: '#ff607a',
  J: '#5d8cff',
  L: '#ff9b45',
};

const PLAYER_COLORS: Record<PlayerId, string> = {
  1: '#b5ff4a',
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

const spawnPiece = (type: PieceName, player: PlayerId, cols: number): ActivePiece => {
  const width = getShape(type, 0).length;
  const center = cols / 2;
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

const getSavedBest = () => {
  if (typeof window === 'undefined') return 0;
  return Number.parseInt(window.localStorage.getItem('shkermitStacksBest') || '0', 10) || 0;
};

const initialGame = (): GameState => ({
  board: makeBoard(SOLO_COLS),
  active: [],
  status: 'ready',
  cols: SOLO_COLS,
  score: 0,
  lines: 0,
  level: 1,
  combo: -1,
  best: getSavedBest(),
  meter: 0,
  next: { 1: 'T' },
  message: 'Ready to stack',
});

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

export default function TetrisGame() {
  const [game, setGame] = useState<GameState>(initialGame);
  const gameRef = useRef(game);
  const bagRef = useRef<PieceName[]>([]);

  const publish = useCallback((nextGame: GameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
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

  const endGame = useCallback((data: GameState) => {
    const best = Math.max(data.best, data.score);
    window.localStorage.setItem('shkermitStacksBest', String(best));
    publish({ ...data, status: 'gameover', best, message: 'The stack got the crew' });
  }, [publish]);

  const startGame = useCallback(() => {
    bagRef.current = [];
    const cols = SOLO_COLS;
    const firstOne = drawType();
    const nextOne = drawType();
    const active = [spawnPiece(firstOne, 1, cols)];

    publish({
      board: makeBoard(cols),
      active,
      status: 'playing',
      cols,
      score: 0,
      lines: 0,
      level: 1,
      combo: -1,
      best: gameRef.current.best,
      meter: 0,
      next: { 1: nextOne },
      message: 'Stack steady.',
    });
  }, [drawType, publish]);

  const lockPiece = useCallback((source: GameState, player: PlayerId) => {
    const piece = source.active.find((item) => item.player === player);
    if (!piece) return;

    if (getCells(piece).some(({ y }) => y < 0)) {
      endGame(source);
      return;
    }

    let board = source.board.map((row) => [...row]);
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
    if (fullRows.length) {
      active = active.map((item) => {
        const lowestCell = Math.max(...getCells(item).map(({ y }) => y));
        const shift = fullRows.filter((row) => row > lowestCell).length;
        return shift ? { ...item, y: item.y + shift } : item;
      });
    }

    const combo = fullRows.length ? source.combo + 1 : -1;
    const scoreTable = [0, 100, 300, 500, 800];
    const gained = Math.round(((scoreTable[fullRows.length] || fullRows.length * 250) + Math.max(0, combo) * 50) * source.level);
    const lines = source.lines + fullRows.length;
    const nextType = source.next[player];
    const spawned = spawnPiece(nextType, player, source.cols);
    const next = { ...source.next, [player]: drawType() };

    const data: GameState = {
      ...source,
      board,
      active,
      next,
      score: source.score + gained,
      lines,
      level: Math.floor(lines / 10) + 1,
      combo,
      meter: Math.min(100, source.meter + fullRows.length * 18),
      message: fullRows.length >= 4
        ? 'SHKERMIT! Four-line clear!'
        : fullRows.length > 0
          ? `${fullRows.length} line${fullRows.length > 1 ? 's' : ''} cleared${combo > 0 ? ` • ${combo + 1}x combo` : ''}`
          : source.message,
    };

    if (!isValid(spawned, board, active, source.cols)) {
      endGame(data);
      return;
    }

    data.active = [...active, spawned];
    if (data.meter >= 100) data.message = 'FROG FLUSH READY • press B';
    publish(data);
  }, [drawType, endGame, publish]);

  const movePlayer = useCallback((player: PlayerId, action: Action) => {
    const source = gameRef.current;
    if (source.status !== 'playing') return;
    const piece = source.active.find((item) => item.player === player);
    if (!piece) return;

    if (action === 'drop') {
      let dropped = { ...piece };
      let distance = 0;
      while (isValid({ ...dropped, y: dropped.y + 1 }, source.board, source.active, source.cols)) {
        dropped = { ...dropped, y: dropped.y + 1 };
        distance += 1;
      }
      const active = source.active.map((item) => item.player === player ? dropped : item);
      lockPiece({ ...source, active, score: source.score + distance * 2 }, player);
      return;
    }

    if (action === 'rotate') {
      const rotated = { ...piece, rotation: (piece.rotation + 1) % 4 };
      const kicks = [0, -1, 1, -2, 2];
      const kicked = kicks
        .map((offset) => ({ ...rotated, x: rotated.x + offset }))
        .find((candidate) => isValid(candidate, source.board, source.active, source.cols));
      if (kicked) publish({ ...source, active: source.active.map((item) => item.player === player ? kicked : item) });
      return;
    }

    const dx = action === 'left' ? -1 : action === 'right' ? 1 : 0;
    const dy = action === 'down' ? 1 : 0;
    const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
    if (isValid(moved, source.board, source.active, source.cols)) {
      publish({
        ...source,
        active: source.active.map((item) => item.player === player ? moved : item),
        score: source.score + (action === 'down' ? 1 : 0),
      });
    } else if (action === 'down') {
      lockPiece(source, player);
    }
  }, [lockPiece, publish]);

  const activateFrogFlush = useCallback(() => {
    const source = gameRef.current;
    if (source.status !== 'playing' || source.meter < 100) return;
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const controlledKeys = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyF', 'ShiftLeft', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'KeyP', 'Escape', 'KeyR', 'KeyB'];
      if (controlledKeys.includes(event.code)) event.preventDefault();

      if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) return togglePause();
      if (event.code === 'KeyR' && !event.repeat && gameRef.current.status !== 'ready') return startGame();
      if (event.code === 'KeyB' && !event.repeat) return activateFrogFlush();
      if (gameRef.current.status !== 'playing') return;

      const playerOne: Partial<Record<string, Action>> = {
        KeyA: 'left', KeyD: 'right', KeyW: 'rotate', KeyS: 'down', KeyF: 'drop', ShiftLeft: 'drop',
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', Enter: 'drop',
      };
      const actionOne = playerOne[event.code];
      if (actionOne && !(event.repeat && (actionOne === 'drop' || actionOne === 'rotate'))) movePlayer(1, actionOne);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activateFrogFlush, movePlayer, startGame, togglePause]);

  useEffect(() => {
    if (game.status !== 'playing') return;
    const speed = Math.max(120, 820 - (game.level - 1) * 60);
    const timer = window.setInterval(() => {
      const players = [...gameRef.current.active]
        .sort((a, b) => Math.max(...getCells(b).map(({ y }) => y)) - Math.max(...getCells(a).map(({ y }) => y)))
        .map(({ player }) => player);
      players.forEach((player) => movePlayer(player, 'down'));
    }, speed);
    return () => window.clearInterval(timer);
  }, [game.level, game.status, movePlayer]);

  const renderedCells = useMemo(() => {
    const cells = new Map<string, { cell: Cell; ghost?: boolean; active?: boolean }>();
    game.board.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) cells.set(`${x}:${y}`, { cell });
    }));
    game.active.forEach((piece) => {
      getCells(getGhost(piece, game.board, game.active, game.cols)).forEach(({ x, y }) => {
        if (y >= 0 && !cells.has(`${x}:${y}`)) cells.set(`${x}:${y}`, { cell: { type: piece.type, owner: piece.player }, ghost: true });
      });
    });
    game.active.forEach((piece) => {
      getCells(piece).forEach(({ x, y }) => {
        if (y >= 0) cells.set(`${x}:${y}`, { cell: { type: piece.type, owner: piece.player }, active: true });
      });
    });
    return cells;
  }, [game.active, game.board, game.cols]);

  if (game.status === 'ready') {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#061008] px-4 py-10 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(151,255,99,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(151,255,99,.05) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
        <img src={shkermitImage} alt="" className="pointer-events-none absolute -bottom-20 -right-24 w-[440px] opacity-15 grayscale" />
        <section className="relative mx-auto max-w-5xl">
          <a href="/games" className="mb-10 inline-flex items-center gap-2 text-xs text-lime-200/60 transition hover:text-lime-200">← BACK TO THE ARCADE</a>
          <div className="mb-12 max-w-3xl">
            <p className="mb-4 text-xs tracking-[0.35em] text-lime-300">SHKERMIT ARCADE / 03</p>
            <h1 className="text-5xl leading-[0.9] text-white sm:text-7xl">SHKERMIT<br /><span className="text-lime-300">STACKS</span></h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/55 sm:text-base">Classic falling blocks, remixed for the pond. Clear lines, build combos, and charge Shkermit's emergency Frog Flush.</p>
          </div>

          <div className="max-w-xl">
            <button onClick={startGame} className="group w-full rounded-2xl border border-lime-300/25 bg-lime-300/[0.06] p-7 text-left transition hover:-translate-y-1 hover:border-lime-300/60 hover:bg-lime-300/[0.1]">
              <div className="mb-10 flex items-start justify-between"><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-white/50">1 PLAYER</span><span className="text-3xl transition group-hover:rotate-6">▦</span></div>
              <h2 className="text-2xl text-lime-200">SOLO STACK</h2>
              <p className="mt-3 text-xs leading-6 text-white/45">The familiar 10 × 20 board. Chase your best score and charge the Frog Flush.</p>
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[10px] text-white/35">
            <span>7-BAG RANDOMIZER</span><span>GHOST PIECES</span><span>COMBO SCORING</span><span>TOUCH READY</span>
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
            <span className="text-white/45">SOLO RUN · LVL {game.level}</span>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(320px,560px)_250px] xl:justify-center">
          <aside className="order-2 grid grid-cols-3 gap-3 xl:order-1 xl:grid-cols-1">
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">SCORE</p>
              <p className="mt-2 text-xl text-white sm:text-2xl">{game.score.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">LINES / BEST</p>
              <p className="mt-2 text-sm text-lime-200">{game.lines} <span className="text-white/20">/</span> {game.best.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-[9px] tracking-[0.2em] text-white/35">COMBO</p>
              <p className="mt-2 text-sm text-pink-200">{game.combo > 0 ? `${game.combo + 1}×` : '—'}</p>
            </div>
            <div className="col-span-3 rounded-xl border border-lime-300/15 bg-lime-300/[0.04] p-4 xl:col-span-1">
              <div className="mb-2 flex justify-between text-[9px]"><span className="text-lime-200">FROG FLUSH</span><span className="text-white/40">{game.meter}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-linear-to-r from-lime-500 to-yellow-200 transition-all" style={{ width: `${game.meter}%` }} /></div>
              <p className="mt-3 text-[9px] leading-4 text-white/35">Fill by clearing lines. Press <span className="text-white">B</span> at 100% to wash away two danger rows.</p>
            </div>
          </aside>

          <section className="order-1 flex flex-col items-center xl:order-2">
            <div className="mb-2 flex w-full items-center justify-between text-[9px] text-white/35" style={{ maxWidth: 400 }}>
              <span className="text-lime-200">SOLO</span><span>{game.message}</span><span />
            </div>
            <div
              className="relative grid overflow-hidden rounded-xl border-2 border-lime-200/30 bg-[#020704] p-1 shadow-[0_0_60px_rgba(118,255,76,0.08)]"
              style={{
                width: 'min(82vw, 400px)',
                aspectRatio: `${game.cols} / ${ROWS}`,
                gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                gap: '1px',
              }}
            >
              {Array.from({ length: ROWS * game.cols }, (_, index) => {
                const x = index % game.cols;
                const y = Math.floor(index / game.cols);
                const rendered = renderedCells.get(`${x}:${y}`);
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

              {(game.status === 'paused' || game.status === 'gameover') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020704]/90 p-8 text-center backdrop-blur-sm">
                  <img src={shkermitImage} alt="Shkermit" className="mb-4 h-24 w-24 object-contain" />
                  <p className="text-[10px] tracking-[0.3em] text-lime-300">{game.status === 'paused' ? 'POND BREAK' : 'STACK OVER'}</p>
                  <h2 className="mt-3 text-2xl">{game.status === 'paused' ? 'PAUSED' : `${game.score.toLocaleString()} PTS`}</h2>
                  <div className="mt-6 flex gap-2">
                    {game.status === 'paused' && <button onClick={togglePause} className="rounded-lg bg-lime-300 px-4 py-3 text-[10px] text-[#061008]">KEEP STACKING</button>}
                    <button onClick={startGame} className="rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-[10px]">RESTART</button>
                  </div>
                  {game.status === 'gameover' && <button onClick={() => publish({ ...initialGame(), best: game.best })} className="mt-4 text-[9px] text-white/40 underline">MAIN MENU</button>}
                </div>
              )}
            </div>
          </section>

          <aside className="order-3 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-lime-300/15 bg-white/[0.035] p-4">
                <div><p className="text-[9px] text-lime-200">NEXT PIECE</p><p className="mt-2 text-[9px] leading-4 text-white/35">A D / ← → move<br />W / ↑ rotate · F drop</p></div>
                <MiniPiece type={game.next[1]} player={1} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={togglePause} className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-3 text-[9px] text-white/50 hover:bg-white/10">{game.status === 'paused' ? 'RESUME' : 'PAUSE'} · P</button>
              <button onClick={startGame} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-[9px] text-white/50 hover:bg-white/10">↻</button>
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-xl border border-lime-300/10 bg-white/[0.025] p-3"><p className="mb-2 text-center text-[9px] text-lime-200">TOUCH CONTROLS</p><ControlPad player={1} onAction={movePlayer} /></div>
        </div>
      </div>
    </main>
  );
}
