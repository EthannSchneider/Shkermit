import { randomInt } from "node:crypto";
import { detectTSpin, getRotationCandidates, scoreClear } from "./tetris-rules.js";

const ROWS = 20;
const SOLO_COLS = 10;
const COOP_COLS = 14;
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;
const PIECES = ["I", "O", "T", "S", "Z", "J", "L"];

const BASE_SHAPES = {
  I: ["....", "####", "....", "...."],
  O: ["##", "##"],
  T: [".#.", "###", "..."],
  S: [".##", "##.", "..."],
  Z: ["##.", ".##", "..."],
  J: ["#..", "###", "..."],
  L: ["..#", "###", "..."],
};

function rotateMatrix(matrix) {
  const size = matrix.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - col - 1][row]).join(""),
  );
}

function getShape(type, rotation) {
  let shape = BASE_SHAPES[type];
  for (let step = 0; step < rotation % 4; step += 1) shape = rotateMatrix(shape);
  return shape;
}

function getCells(piece) {
  const cells = [];
  getShape(piece.type, piece.rotation).forEach((row, rowIndex) => {
    [...row].forEach((value, colIndex) => {
      if (value === "#") cells.push({ x: piece.x + colIndex, y: piece.y + rowIndex });
    });
  });
  return cells;
}

function makeBoard(cols) {
  return Array.from({ length: ROWS }, () => Array(cols).fill(null));
}

function spawnPiece(type, player, cols, mode) {
  const width = getShape(type, 0).length;
  const center = mode === "coop" ? cols * (player === 1 ? 0.28 : 0.72) : cols / 2;
  return {
    type,
    player,
    rotation: 0,
    x: Math.max(0, Math.min(cols - width, Math.round(center - width / 2))),
    y: type === "I" ? -1 : 0,
    lockElapsed: 0,
    lockResets: 0,
  };
}

function isValid(piece, board, active, cols) {
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
}

function getPlayerBoard(state, player) {
  return state.mode === "duel" ? state.duelBoards[player] : state.board;
}

function getCollidingPieces(state, player) {
  return state.mode === "duel"
    ? state.active.filter((piece) => piece.player === player)
    : state.active;
}

function isGrounded(piece, state) {
  return !isValid({ ...piece, y: piece.y + 1 }, getPlayerBoard(state, piece.player),
    getCollidingPieces(state, piece.player), state.cols);
}

function updateLockAfterMove(previous, moved, state) {
  if (moved.rotation === previous.rotation && (moved.x !== previous.x || moved.y !== previous.y)) {
    moved = { ...moved, lastRotationKick: undefined };
  }
  const resets = previous.lockResets ?? 0;
  const adjusted = moved.x !== previous.x || moved.rotation !== previous.rotation;
  if (adjusted && isGrounded(previous, state) && resets < MAX_LOCK_RESETS) {
    return { ...moved, lockElapsed: 0, lockResets: resets + 1 };
  }
  return isGrounded(moved, state) ? moved : { ...moved, lockElapsed: 0 };
}

function shuffleBag() {
  const bag = [...PIECES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
}

function drawType(session) {
  if (session.bag.length === 0) session.bag = shuffleBag();
  return session.bag.pop();
}

function drawDuelType(session, player) {
  const index = session.duelDrawIndex[player];
  if (index >= session.duelSequence.length) session.duelSequence.push(...shuffleBag());
  session.duelDrawIndex[player] += 1;
  return session.duelSequence[index];
}

function drawForPlayer(session, player) {
  return session.state?.mode === "duel"
    ? drawDuelType(session, player)
    : drawType(session);
}

function startGame(session) {
  session.gravityElapsed = 0;
  session.bag = [];
  session.duelSequence = [];
  session.duelDrawIndex = { 1: 0, 2: 0 };

  const { mode } = session;
  const cols = mode === "coop" ? COOP_COLS : SOLO_COLS;
  const firstOne = mode === "duel" ? drawDuelType(session, 1) : drawType(session);
  const nextOne = mode === "duel" ? drawDuelType(session, 1) : drawType(session);
  const firstTwo = mode === "duel" ? drawDuelType(session, 2) : drawType(session);
  const nextTwo = mode === "duel" ? drawDuelType(session, 2) : drawType(session);

  session.state = {
    mode,
    board: makeBoard(cols),
    duelBoards: mode === "duel" ? { 1: makeBoard(cols), 2: makeBoard(cols) } : null,
    active: [
      spawnPiece(firstOne, 1, cols, mode),
      spawnPiece(firstTwo, 2, cols, mode),
    ],
    status: "playing",
    cols,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    backToBack: false,
    best: 0,
    meter: 0,
    next: { 1: nextOne, 2: nextTwo },
    hold: { 1: null, 2: null },
    holdUsed: { 1: false, 2: false },
    playerStats: {
      1: { score: 0, lines: 0, combo: -1, backToBack: false },
      2: { score: 0, lines: 0, combo: -1, backToBack: false },
    },
    winner: null,
    message: mode === "coop"
      ? "Two frogs. One stack. Work together!"
      : "Clear lines to attack your rival!",
  };
}

function endGame(session, state, loser) {
  if (state.mode === "duel" && loser) {
    const winner = loser === 1 ? 2 : 1;
    session.state = {
      ...state,
      status: "gameover",
      winner,
      message: `PLAYER ${winner} WINS THE DUEL!`,
    };
    return;
  }
  session.state = {
    ...state,
    status: "gameover",
    best: Math.max(state.best, state.score),
    message: "The stack got the crew",
  };
}

function lockPiece(session, source, player) {
  const piece = source.active.find((item) => item.player === player);
  if (!piece) return false;

  if (getCells(piece).some(({ y }) => y < 0)) {
    endGame(session, source, player);
    return true;
  }

  let board = getPlayerBoard(source, player).map((row) => [...row]);
  const spin = detectTSpin(piece, board);
  getCells(piece).forEach(({ x, y }) => {
    board[y][x] = { type: piece.type, owner: player };
  });

  const fullRows = [];
  board.forEach((row, rowIndex) => {
    if (row.every(Boolean)) fullRows.push(rowIndex);
  });
  board = board.filter((_, rowIndex) => !fullRows.includes(rowIndex));
  while (board.length < ROWS) board.unshift(Array(source.cols).fill(null));

  let active = source.active.filter((item) => item.player !== player);
  if (fullRows.length && source.mode !== "duel") {
    active = active.map((item) => {
      const lowestCell = Math.max(...getCells(item).map(({ y }) => y));
      const shift = fullRows.filter((row) => row > lowestCell).length;
      return shift ? { ...item, y: item.y + shift, lastRotationKick: undefined } : item;
    });
  }

  const previousCombo = source.mode === "duel"
    ? source.playerStats[player].combo
    : source.combo;
  const previousBackToBack = source.mode === "duel"
    ? source.playerStats[player].backToBack
    : source.backToBack;
  const { combo, backToBack, gained, attackRows, label } = scoreClear(
    spin, fullRows.length, source.level, previousCombo, previousBackToBack,
  );
  const playerLines = source.playerStats[player].lines + fullRows.length;
  const nextType = source.next[player];
  const spawned = spawnPiece(nextType, player, source.cols, source.mode);
  const next = { ...source.next, [player]: drawForPlayer(session, player) };
  const playerStats = {
    ...source.playerStats,
    [player]: {
      score: source.playerStats[player].score + gained,
      lines: playerLines,
      combo,
      backToBack,
    },
  };
  let duelBoards = source.duelBoards;
  if (source.mode === "duel") duelBoards = { ...source.duelBoards, [player]: board };

  const data = {
    ...source,
    board: source.mode === "duel" ? source.board : board,
    duelBoards,
    active,
    next,
    holdUsed: { ...source.holdUsed, [player]: false },
    score: source.score + gained,
    lines: source.lines + fullRows.length,
    level: source.mode === "duel"
      ? Math.floor(Math.max(playerStats[1].lines, playerStats[2].lines) / 10) + 1
      : Math.floor((source.lines + fullRows.length) / 10) + 1,
    combo,
    backToBack,
    meter: source.mode === "duel" ? 0 : Math.min(100, source.meter + fullRows.length * 18),
    playerStats,
    message: label ?? (source.mode === "duel" && fullRows.length >= 2
      ? `PLAYER ${player} ATTACKS!`
      : fullRows.length >= 4
        ? "SHKERMIT! Four-line clear!"
        : fullRows.length > 0
          ? `${fullRows.length} line${fullRows.length > 1 ? "s" : ""} cleared${combo > 0 ? ` • ${combo + 1}x combo` : ""}`
          : source.message),
  };

  if (source.mode === "duel") {
    if (attackRows > 0) {
      const opponent = player === 1 ? 2 : 1;
      const opponentBoard = data.duelBoards[opponent];
      const overflow = opponentBoard.slice(0, attackRows).some((row) => row.some(Boolean));
      const garbageRows = Array.from({ length: attackRows }, () => {
        const hole = randomInt(source.cols);
        return Array.from({ length: source.cols }, (_, x) => (
          x === hole ? null : { type: "G", owner: player }
        ));
      });
      data.duelBoards = {
        ...data.duelBoards,
        [opponent]: [...opponentBoard.slice(attackRows), ...garbageRows],
      };
      data.active = data.active.map((item) => item.player === opponent
        ? { ...item, y: item.y - attackRows, lastRotationKick: undefined }
        : item);
      data.message = `${label ? `${label} • ` : ""}PLAYER ${player} SENT ${attackRows} GARBAGE ROW${attackRows > 1 ? "S" : ""}!`;
      if (overflow) {
        endGame(session, data, opponent);
        return true;
      }
    }
  }

  const collisionPieces = source.mode === "duel" ? [] : data.active;
  if (!isValid(spawned, board, collisionPieces, source.cols)) {
    endGame(session, data, player);
    return true;
  }

  data.active = [...data.active, spawned];
  if (data.meter >= 100) data.message = label ? `${data.message} • FROG FLUSH READY` : "FROG FLUSH READY";
  session.state = data;
  return true;
}

export function createTetrisGame(mode) {
  const session = {
    mode: mode === "duel" ? "duel" : "coop",
    state: null,
    bag: [],
    duelSequence: [],
    duelDrawIndex: { 1: 0, 2: 0 },
  };
  startGame(session);
  return session;
}

export function moveTetrisPlayer(session, player, action) {
  if (!["left", "right", "rotate", "rotate_ccw", "down", "drop", "hold"].includes(action)) return false;
  const source = session.state;
  if (source.status !== "playing" || (player !== 1 && player !== 2)) return false;
  const piece = source.active.find((item) => item.player === player);
  if (!piece) return false;
  const board = getPlayerBoard(source, player);
  const collisionPieces = getCollidingPieces(source, player);

  if (action === "hold") {
    if (source.holdUsed[player]) return false;
    const held = source.hold[player];
    const spawned = spawnPiece(held ?? source.next[player], player, source.cols, source.mode);
    const state = {
      ...source,
      active: source.active.map((item) => item.player === player ? spawned : item),
      hold: { ...source.hold, [player]: piece.type },
      holdUsed: { ...source.holdUsed, [player]: true },
      next: held ? source.next : { ...source.next, [player]: drawForPlayer(session, player) },
    };
    if (!isValid(spawned, board, collisionPieces, source.cols)) endGame(session, state, player);
    else session.state = state;
    return true;
  }

  if (action === "drop") {
    let dropped = { ...piece };
    let distance = 0;
    while (isValid({ ...dropped, y: dropped.y + 1 }, board, collisionPieces, source.cols)) {
      dropped = { ...dropped, y: dropped.y + 1, lastRotationKick: undefined };
      distance += 1;
    }
    const active = source.active.map((item) => item.player === player ? dropped : item);
    const playerStats = source.mode === "duel" ? {
      ...source.playerStats,
      [player]: {
        ...source.playerStats[player],
        score: source.playerStats[player].score + distance * 2,
      },
    } : source.playerStats;
    return lockPiece(session, { ...source, active, score: source.score + distance * 2, playerStats }, player);
  }

  if (action === "rotate" || action === "rotate_ccw") {
    const kicked = getRotationCandidates(piece, action === "rotate")
      .find((candidate) => isValid(candidate, board, collisionPieces, source.cols));
    if (!kicked) return false;
    session.state = {
      ...source,
      active: source.active.map((item) => item.player === player ? updateLockAfterMove(piece, kicked, source) : item),
    };
    return true;
  }

  const dx = action === "left" ? -1 : action === "right" ? 1 : 0;
  const dy = action === "down" ? 1 : 0;
  const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
  if (isValid(moved, board, collisionPieces, source.cols)) {
    const playerStats = source.mode === "duel" && action === "down" ? {
      ...source.playerStats,
      [player]: {
        ...source.playerStats[player],
        score: source.playerStats[player].score + 1,
      },
    } : source.playerStats;
    session.state = {
      ...source,
      active: source.active.map((item) => item.player === player ? updateLockAfterMove(piece, moved, source) : item),
      score: source.score + (action === "down" ? 1 : 0),
      playerStats,
    };
    return true;
  }
  return false;
}

function activateFrogFlush(session) {
  const source = session.state;
  if (source.status !== "playing" || source.mode === "duel" || source.meter < 100) return false;
  const occupiedRows = source.board
    .map((row, index) => ({ index, occupied: row.some(Boolean) }))
    .filter(({ occupied }) => occupied)
    .map(({ index }) => index)
    .slice(-2);
  if (!occupiedRows.length) return false;

  const board = source.board.filter((_, index) => !occupiedRows.includes(index));
  while (board.length < ROWS) board.unshift(Array(source.cols).fill(null));
  const active = source.active.map((piece) => {
    const lowestCell = Math.max(...getCells(piece).map(({ y }) => y));
    const shift = occupiedRows.filter((row) => row > lowestCell).length;
    return shift ? { ...piece, y: piece.y + shift, lastRotationKick: undefined } : piece;
  });
  session.state = {
    ...source,
    board,
    active,
    meter: 0,
    score: source.score + occupiedRows.length * 250 * source.level,
    message: `FROG FLUSH! ${occupiedRows.length} danger row${occupiedRows.length > 1 ? "s" : ""} gone.`,
  };
  return true;
}

export function commandTetrisGame(session, command) {
  if (command === "restart") {
    startGame(session);
    return true;
  }
  if (command === "frog_flush") return activateFrogFlush(session);
  if (command !== "toggle_pause") return false;

  if (session.state.status === "playing") {
    session.state = { ...session.state, status: "paused", message: "Stack break" };
    return true;
  }
  if (session.state.status === "paused") {
    session.state = { ...session.state, status: "playing", message: "Back in the pond" };
    return true;
  }
  return false;
}

export function pauseTetrisGame(session, message) {
  if (session?.state.status !== "playing") return false;
  session.state = { ...session.state, status: "paused", message };
  return true;
}

export function tickTetrisGame(session, elapsed = 25) {
  if (session.state.status !== "playing") return false;
  const players = [...session.state.active]
    .sort((a, b) => (
      Math.max(...getCells(b).map(({ y }) => y))
      - Math.max(...getCells(a).map(({ y }) => y))
    ))
    .map(({ player }) => player);
  let changed = false;
  const locked = new Set();
  players.forEach((player) => {
    if (session.state.status !== "playing") return;
    const state = session.state;
    const piece = state.active.find((item) => item.player === player);
    if (!piece) return;
    const lockElapsed = isGrounded(piece, state) ? (piece.lockElapsed ?? 0) + elapsed : 0;
    session.state = {
      ...state,
      active: state.active.map((item) => item.player === player ? { ...piece, lockElapsed } : item),
    };
    if (lockElapsed >= LOCK_DELAY) {
      changed = lockPiece(session, session.state, player) || changed;
      locked.add(player);
    }
  });
  session.gravityElapsed += elapsed;
  const speed = getTetrisDropDelay(session);
  if (session.gravityElapsed >= speed) {
    session.gravityElapsed %= speed;
    players.forEach((player) => {
      if (!locked.has(player) && session.state.status === "playing") {
        changed = moveTetrisPlayer(session, player, "down") || changed;
      }
    });
  }
  return changed;
}

export function getTetrisDropDelay(session) {
  return Math.max(120, 820 - (session.state.level - 1) * 60);
}
