import { PIECES, ROWS } from './constants';
import { getCells, getCollidingPieces, getPlayerBoard, spawnPiece } from './game-logic';
import { getRotationCandidates } from './tetris-rules';
import type { Action, ActivePiece, Cell, GameState, PieceName, PlayerId } from './types';
import { DEFAULT_AUTO_SETTINGS, type AutoPlaySettings, type AutoPlayStyle } from './auto-settings';

type Board = (Cell | null)[][];
type Placement = { board: Board; value: number };
type Offset = { x: number; y: number };
const styleWeights: Record<AutoPlayStyle, { lines: number; height: number; holes: number; bumpiness: number; danger: number }> = {
  balanced: { lines: 8, height: 0.5, holes: 9, bumpiness: 0.4, danger: 2 },
  safe: { lines: 6, height: 0.8, holes: 12, bumpiness: 0.65, danger: 4 },
  aggressive: { lines: 14, height: 0.35, holes: 7, bumpiness: 0.25, danger: 1.5 },
};

// Cache the 28 shapes once; the search performs many collision checks per move.
const offsets = Object.fromEntries(PIECES.map((type) => [type,
  Array.from({ length: 4 }, (_, rotation) => getCells({ type, rotation, player: 1, x: 0, y: 0 })),
])) as Record<PieceName, Offset[][]>;

function fits(cells: Offset[], x: number, y: number, board: Board, cols: number, occupied?: Set<number>) {
  return cells.every((cell) => {
    const cellX = x + cell.x;
    const cellY = y + cell.y;
    return cellX >= 0 && cellX < cols && cellY < ROWS
      && !(cellY >= 0 && board[cellY][cellX])
      && !occupied?.has((cellY + 4) * cols + cellX);
  });
}

function drop(piece: ActivePiece, board: Board, cols: number, occupied?: Set<number>) {
  const cells = offsets[piece.type][piece.rotation];
  let y = piece.y;
  while (fits(cells, piece.x, y + 1, board, cols, occupied)) y += 1;
  return { ...piece, y };
}

function place(board: Board, piece: ActivePiece, style: AutoPlayStyle): Placement | null {
  const cells = offsets[piece.type][piece.rotation];
  if (cells.some(({ y }) => piece.y + y < 0)) return null;
  const placed = board.map((row) => [...row]);
  for (const { x, y } of cells) placed[piece.y + y][piece.x + x] = { type: piece.type, owner: piece.player };
  const remaining = placed.filter((row) => !row.every(Boolean));
  const lines = ROWS - remaining.length;
  while (remaining.length < ROWS) remaining.unshift(Array<Cell | null>(board[0].length).fill(null));

  const heights = Array<number>(board[0].length).fill(0);
  let holes = 0;
  for (let x = 0; x < heights.length; x += 1) {
    let occupied = false;
    for (let y = 0; y < ROWS; y += 1) {
      if (remaining[y][x]) {
        if (!occupied) heights[x] = ROWS - y;
        occupied = true;
      } else if (occupied) holes += 1;
    }
  }
  const height = heights.reduce((sum, value) => sum + value, 0);
  const bumpiness = heights.slice(1).reduce((sum, value, index) => sum + Math.abs(value - heights[index]), 0);
  const tallest = Math.max(...heights);
  const weights = styleWeights[style];
  return {
    board: remaining,
    value: lines * weights.lines - height * weights.height - holes * weights.holes
      - bumpiness * weights.bumpiness - Math.max(0, tallest - 12) * weights.danger,
  };
}

// The preview is used to avoid placements that leave the next piece without a safe landing.
function previewValue(board: Board, type: PieceName, player: PlayerId, game: GameState, style: AutoPlayStyle) {
  let best = -10000;
  const spawn = spawnPiece(type, player, game.cols, game.mode);
  for (let rotation = 0; rotation < 4; rotation += 1) {
    for (let x = -3; x < game.cols; x += 1) {
      const piece = { ...spawn, rotation, x };
      if (!fits(offsets[type][rotation], x, piece.y, board, game.cols)) continue;
      const placement = place(board, drop(piece, board, game.cols), style);
      if (placement) best = Math.max(best, placement.value);
    }
  }
  return best;
}

export function planAutoPlay(game: GameState, player: PlayerId, settings: AutoPlaySettings = DEFAULT_AUTO_SETTINGS): Action[] | null {
  const initial = game.active.find((piece) => piece.player === player);
  if (game.status !== 'playing' || !initial) return null;
  const board = getPlayerBoard(game, player);
  const active = getCollidingPieces(game, player);
  const occupied = new Set(active.filter((piece) => piece.player !== player).flatMap(getCells)
    .map(({ x, y }) => (y + 4) * game.cols + x));
  const valid = (piece: ActivePiece) => fits(offsets[piece.type][piece.rotation], piece.x, piece.y, board, game.cols, occupied);
  if (!valid(initial)) return null;
  const key = (piece: ActivePiece) => `${piece.x}:${piece.y}:${piece.rotation}`;
  const queue: { piece: ActivePiece; actions: Action[] }[] = [{ piece: initial, actions: [] }];
  const visited = new Set([key(initial)]);
  const landings = new Set<string>();
  let bestValue = -Infinity;
  let bestActions: Action[] | null = null;

  // Search actual moves and SRS kicks so every chosen placement has a legal route.
  for (let index = 0; index < queue.length && index < 2000; index += 1) {
    const { piece, actions } = queue[index];
    const dropped = drop(piece, board, game.cols, occupied);
    const landingKey = key(dropped);
    if (!landings.has(landingKey)) {
      landings.add(landingKey);
      const placement = place(board, dropped, settings.playStyle);
      if (placement) {
        const value = placement.value + (settings.lookAhead
          ? previewValue(placement.board, game.next[player], player, game, settings.playStyle) * 0.6 : 0);
        if (value > bestValue || (value === bestValue && actions.length + 1 < (bestActions?.length ?? Infinity))) {
          bestValue = value;
          bestActions = [...actions, 'drop'];
        }
      }
    }

    const moves: [Action, ActivePiece | undefined][] = [
      ['left', { ...piece, x: piece.x - 1 }],
      ['right', { ...piece, x: piece.x + 1 }],
      ['rotate', getRotationCandidates(piece, true).find(valid)],
      ['rotate_ccw', getRotationCandidates(piece, false).find(valid)],
      ['down', { ...piece, y: piece.y + 1 }],
    ];
    for (const [action, moved] of moves) {
      if (!moved || moved.y < -4 || !valid(moved) || visited.has(key(moved))) continue;
      visited.add(key(moved));
      queue.push({ piece: moved, actions: [...actions, action] });
    }
  }
  return bestActions;
}

export function shouldAutoFlush(game: GameState, settings: AutoPlaySettings) {
  return settings.autoFlush && game.status === 'playing' && game.mode !== 'duel'
    && game.meter >= 100 && game.board.slice(0, ROWS - 9).some((row) => row.some(Boolean));
}
