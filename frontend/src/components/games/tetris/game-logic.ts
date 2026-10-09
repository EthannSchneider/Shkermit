import { BASE_SHAPES, MAX_LOCK_RESETS, ROWS } from './constants';
import type { ActivePiece, Cell, GameMode, GameState, PieceName, PlayerId } from './types';

const rotateMatrix = (matrix: string[]) => {
  const size = matrix.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - col - 1][row]).join(''),
  );
};

export const getShape = (type: PieceName, rotation: number) => {
  let shape = BASE_SHAPES[type];
  for (let step = 0; step < rotation % 4; step += 1) shape = rotateMatrix(shape);
  return shape;
};

export const getCells = (piece: ActivePiece) => {
  const cells: { x: number; y: number }[] = [];
  getShape(piece.type, piece.rotation).forEach((row, rowIndex) => {
    [...row].forEach((value, colIndex) => {
      if (value === '#') cells.push({ x: piece.x + colIndex, y: piece.y + rowIndex });
    });
  });
  return cells;
};

export const makeBoard = (cols: number): (Cell | null)[][] =>
  Array.from({ length: ROWS }, () => Array<Cell | null>(cols).fill(null));

export const spawnPiece = (
  type: PieceName,
  player: PlayerId,
  cols: number,
  mode: GameMode,
): ActivePiece => {
  const width = getShape(type, 0).length;
  const center = mode === 'coop' ? cols * (player === 1 ? 0.28 : 0.72) : cols / 2;
  return {
    type,
    player,
    rotation: 0,
    x: Math.max(0, Math.min(cols - width, Math.round(center - width / 2))),
    y: type === 'I' ? -1 : 0,
    lockElapsed: 0,
    lockResets: 0,
  };
};

export const isValid = (
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

export const getGhost = (
  piece: ActivePiece,
  board: (Cell | null)[][],
  active: ActivePiece[],
  cols: number,
) => {
  let ghost = { ...piece };
  while (isValid({ ...ghost, y: ghost.y + 1 }, board, active, cols)) {
    ghost = { ...ghost, y: ghost.y + 1 };
  }
  return ghost;
};

export const getPlayerBoard = (game: GameState, player: PlayerId) => (
  game.mode === 'duel' ? game.duelBoards![player] : game.board
);

export const getCollidingPieces = (game: GameState, player: PlayerId) => (
  game.mode === 'duel' ? game.active.filter((piece) => piece.player === player) : game.active
);

export const isGrounded = (piece: ActivePiece, game: GameState) => !isValid(
  { ...piece, y: piece.y + 1 },
  getPlayerBoard(game, piece.player),
  getCollidingPieces(game, piece.player),
  game.cols,
);

export const updateLockAfterMove = (previous: ActivePiece, moved: ActivePiece, game: GameState) => {
  // Successful translations cancel spin credit; blocked moves never reach here.
  if (moved.rotation === previous.rotation && (moved.x !== previous.x || moved.y !== previous.y)) {
    moved = { ...moved, lastRotationKick: undefined };
  }
  const resets = previous.lockResets ?? 0;
  const adjusted = moved.x !== previous.x || moved.rotation !== previous.rotation;
  if (adjusted && isGrounded(previous, game) && resets < MAX_LOCK_RESETS) {
    return { ...moved, lockElapsed: 0, lockResets: resets + 1 };
  }
  return isGrounded(moved, game) ? moved : { ...moved, lockElapsed: 0 };
};

export const advanceLock = (piece: ActivePiece, game: GameState, elapsed: number): ActivePiece => ({
  ...piece,
  lockElapsed: isGrounded(piece, game) ? (piece.lockElapsed ?? 0) + elapsed : 0,
});

export const holdPiece = (game: GameState, player: PlayerId, draw: () => PieceName): GameState | null => {
  const piece = game.active.find((item) => item.player === player);
  if (game.status !== 'playing' || !piece || game.holdUsed?.[player]) return null;
  const held = game.hold?.[player] ?? null;
  const spawned = spawnPiece(held ?? game.next[player], player, game.cols, game.mode);
  return {
    ...game,
    active: game.active.map((item) => item.player === player ? spawned : item),
    hold: { ...(game.hold ?? { 1: null, 2: null }), [player]: piece.type },
    holdUsed: { ...(game.holdUsed ?? { 1: false, 2: false }), [player]: true },
    next: held ? game.next : { ...game.next, [player]: draw() },
  };
};
