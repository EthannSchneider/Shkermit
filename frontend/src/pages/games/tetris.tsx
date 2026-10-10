import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TetrisGame from '../../components/games/tetris/tetris-game';
import {
  COOP_COLS,
  DEFAULT_BINDINGS,
  KEY_BINDINGS_STORAGE_KEY,
  KEYBOARD_ACTIONS,
  LOCK_DELAY,
  MOVEMENT_REPEAT,
  PIECES,
  ROWS,
  SOLO_COLS,
} from '../../components/games/tetris/constants';
import {
  advanceLock,
  getCells,
  getCollidingPieces,
  getGhost,
  getPlayerBoard,
  holdPiece,
  isValid,
  makeBoard,
  spawnPiece,
  updateLockAfterMove,
} from '../../components/games/tetris/game-logic';
import {
  clearMultiplayerSession,
  getSavedBest,
  getSavedBindings,
  getSavedMultiplayerSession,
  initialCoop,
  initialGame,
  isGameState,
  keyLabelFromEvent,
  persistMultiplayerSession,
} from '../../components/games/tetris/storage';
import type {
  Action,
  Cell,
  CoopState,
  GameCommand,
  GameMode,
  GameState,
  KeyboardAction,
  KeyboardBindings,
  PieceName,
  PlayerId,
  SavedMultiplayerSession,
} from '../../components/games/tetris/types';
import { useBestScore } from '../../hooks/use-best-score';
import { useTetrisAudio } from '../../components/games/tetris/use-tetris-audio';
import { detectTSpin, getRotationCandidates, scoreClear } from '../../components/games/tetris/tetris-rules';
import { planAutoPlay, shouldAutoFlush } from '../../components/games/tetris/auto-player';
import { AUTO_SETTINGS_STORAGE_KEY, getAutoActionInterval, getSavedAutoSettings, normalizeAutoSettings, type AutoPlaySettings } from '../../components/games/tetris/auto-settings';
import { useAuth } from '../../context/auth-context';

const getMessagePlayerNames = (value: unknown): Record<PlayerId, string | null> => {
  const names = value && typeof value === 'object'
    ? value as Partial<Record<PlayerId, unknown>>
    : {};
  const cleanName = (name: unknown) => {
    if (typeof name !== 'string') return null;
    const cleaned = name.trim();
    return cleaned ? cleaned.slice(0, 32) : null;
  };
  return { 1: cleanName(names[1]), 2: cleanName(names[2]) };
};

function useTetrisGame() {
  const { user } = useAuth();
  const canAutoPlay = Boolean(user?.isAdmin && user.emailVerified && !user.isSuspended);
  const [autoUserId, setAutoUserId] = useState<number | null>(null);
  const [game, setGame] = useState<GameState>(initialGame);
  const [autoSettings, setAutoSettings] = useState(getSavedAutoSettings);
  const [autoSettingsSaveError, setAutoSettingsSaveError] = useState('');
  const [autoSettingsRequested, setAutoSettingsRequested] = useState(false);
  const autoSettingsOpen = autoSettingsRequested && canAutoPlay && game.status !== 'ready';
  const autoEnabled = canAutoPlay && autoUserId === user?.id && game.status !== 'ready' && game.status !== 'gameover';
  const [coop, setCoop] = useState<CoopState>(initialCoop);
  const soloBest = useBestScore('tetris', 'solo', getSavedBest('solo'));
  const coopBest = useBestScore('tetris', 'coop', getSavedBest('coop'), false);
  const duelBest = useBestScore('tetris', 'duel', getSavedBest('duel'), false);
  const [joinCode, setJoinCode] = useState('');
  const [keyBindings, setKeyBindings] = useState<KeyboardBindings>(getSavedBindings);
  const [bindingAction, setBindingAction] = useState<KeyboardAction | null>(null);
  const gameRef = useRef(game);
  const bagRef = useRef<PieceName[]>([]);
  const gravityElapsedRef = useRef(0);
  const duelSequenceRef = useRef<PieceName[]>([]);
  const duelDrawIndexRef = useRef<Record<PlayerId, number>>({ 1: 0, 2: 0 });
  const socketRef = useRef<WebSocket | null>(null);
  const localPlayerRef = useRef<PlayerId | null>(null);
  const multiplayerSessionRef = useRef<SavedMultiplayerSession | null>(getSavedMultiplayerSession());
  const intentionalCloseRef = useRef(false);
  const socketMessageHandlerRef = useRef<(message: Record<string, unknown>) => void>(() => undefined);
  const { soundEnabled, toggleSound, playLockSound } = useTetrisAudio(game);

  const sendSocketMessage = useCallback((message: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const publish = useCallback((nextGame: GameState) => {
    if (nextGame.status === 'ready') setAutoSettingsRequested(false);
    if (nextGame.status === 'gameover' || nextGame.status === 'ready') setAutoUserId(null);
    gameRef.current = nextGame;
    setGame(nextGame);
    if (nextGame.mode !== 'solo' && multiplayerSessionRef.current) {
      multiplayerSessionRef.current = {
        ...multiplayerSessionRef.current,
        game: nextGame,
      };
      persistMultiplayerSession(multiplayerSessionRef.current);
    }
  }, []);

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
    setAutoUserId(null);
    gravityElapsedRef.current = 0;
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
      backToBack: false,
      best: getSavedBest(mode),
      meter: 0,
      next: { 1: nextOne, 2: nextTwo },
      hold: { 1: null, 2: null },
      holdUsed: { 1: false, 2: false },
      playerStats: {
        1: { score: 0, lines: 0, combo: -1, backToBack: false },
        2: { score: 0, lines: 0, combo: -1, backToBack: false },
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
    const spin = detectTSpin(piece, board);
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
        return shift ? { ...item, y: item.y + shift, lastRotationKick: undefined } : item;
      });
    }

    const previousCombo = source.mode === 'duel' ? source.playerStats[player].combo : source.combo;
    const previousBackToBack = source.mode === 'duel' ? source.playerStats[player].backToBack : source.backToBack;
    const { combo, backToBack, gained, attackRows, label } = scoreClear(
      spin, fullRows.length, source.level, previousCombo, previousBackToBack,
    );
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
        backToBack,
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
      holdUsed: { ...source.holdUsed, [player]: false },
      score: source.score + gained,
      lines: source.lines + fullRows.length,
      level: source.mode === 'duel'
        ? Math.floor(Math.max(playerStats[1].lines, playerStats[2].lines) / 10) + 1
        : Math.floor((source.lines + fullRows.length) / 10) + 1,
      combo,
      backToBack,
      meter: source.mode === 'duel' ? 0 : Math.min(100, source.meter + fullRows.length * 18),
      playerStats,
      message: label ?? (source.mode === 'duel' && fullRows.length >= 2
        ? `PLAYER ${player} ATTACKS!`
        : fullRows.length >= 4
        ? 'SHKERMIT! Four-line clear!'
        : fullRows.length > 0
          ? `${fullRows.length} line${fullRows.length > 1 ? 's' : ''} cleared${combo > 0 ? ` • ${combo + 1}x combo` : ''}`
          : source.message),
    };

    if (source.mode === 'solo') playLockSound(fullRows.length);

    if (source.mode === 'duel') {
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
          ? { ...item, y: item.y - attackRows, lastRotationKick: undefined }
          : item);
        data.message = `${label ? `${label} • ` : ''}PLAYER ${player} SENT ${attackRows} GARBAGE ROW${attackRows > 1 ? 'S' : ''}!`;
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
    if (data.meter >= 100) data.message = label ? `${data.message} • FROG FLUSH READY` : 'FROG FLUSH READY';
    publish(data);
  }, [drawDuelType, drawType, endGame, playLockSound, publish]);

  const movePlayer = useCallback((player: PlayerId, action: Action) => {
    const source = gameRef.current;
    if (source.status !== 'playing') return;
    const piece = source.active.find((item) => item.player === player);
    if (!piece) return;
    const board = getPlayerBoard(source, player);
    const collisionPieces = getCollidingPieces(source, player);

    if (action === 'hold') {
      const held = holdPiece(source, player, () => source.mode === 'duel' ? drawDuelType(player) : drawType());
      if (!held) return;
      const spawned = held.active.find((item) => item.player === player)!;
      if (!isValid(spawned, board, collisionPieces, source.cols)) endGame(held, player);
      else publish(held);
      return;
    }

    if (action === 'drop') {
      let dropped = { ...piece };
      let distance = 0;
      while (isValid({ ...dropped, y: dropped.y + 1 }, board, collisionPieces, source.cols)) {
        dropped = { ...dropped, y: dropped.y + 1, lastRotationKick: undefined };
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

    if (action === 'rotate' || action === 'rotate_ccw') {
      const kicked = getRotationCandidates(piece, action === 'rotate')
        .find((candidate) => isValid(candidate, board, collisionPieces, source.cols));
      if (kicked) publish({ ...source, active: source.active.map((item) => item.player === player ? updateLockAfterMove(piece, kicked, source) : item) });
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
        active: source.active.map((item) => item.player === player ? updateLockAfterMove(piece, moved, source) : item),
        score: source.score + (action === 'down' ? 1 : 0),
        playerStats,
      });
    }
  }, [drawDuelType, drawType, endGame, lockPiece, publish]);

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
      return shift ? { ...piece, y: piece.y + shift, lastRotationKick: undefined } : piece;
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
    setAutoSettingsRequested(false);
    setAutoUserId(null);
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
      playerNames: { 1: null, 2: null },
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
    setAutoSettingsRequested(false);
    setAutoUserId(null);
    closeCoopSocket(true);
    multiplayerSessionRef.current = null;
    clearMultiplayerSession();
    const nextGame = initialGame('solo');
    gameRef.current = nextGame;
    setGame(nextGame);
    setCoop(initialCoop());
    setJoinCode('');
  }, [closeCoopSocket]);

  const startSolo = useCallback(() => {
    setAutoSettingsRequested(false);
    closeCoopSocket(true);
    multiplayerSessionRef.current = null;
    clearMultiplayerSession();
    setCoop(initialCoop());
    startGame('solo');
  }, [closeCoopSocket, startGame]);

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
    if (command === 'restart') setAutoUserId(null);
    if (gameRef.current.mode === 'solo') {
      if (command === 'toggle_pause') togglePause();
      if (command === 'restart') startGame('solo');
      if (command === 'frog_flush') activateFrogFlush();
      return;
    }
    sendSocketMessage({ type: 'command', command });
  }, [activateFrogFlush, sendSocketMessage, startGame, togglePause]);

  const toggleAuto = useCallback(() => {
    if (!canAutoPlay || !user) return;
    if (autoEnabled) {
      setAutoUserId(null);
      return;
    }
    const source = gameRef.current;
    if (source.status === 'ready') return;
    if (source.status === 'gameover') sendCommand('restart');
    setAutoUserId(user.id);
  }, [autoEnabled, canAutoPlay, sendCommand, user]);

  const updateAutoSettings = useCallback((settings: AutoPlaySettings) => {
    if (!canAutoPlay) return;
    const normalized = normalizeAutoSettings(settings);
    setAutoSettings(normalized);
    try {
      window.localStorage.setItem(AUTO_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
      setAutoSettingsSaveError('');
    } catch {
      setAutoSettingsSaveError('Settings apply now, but could not be saved on this device.');
    }
  }, [canAutoPlay]);

  const openAutoSettings = useCallback(() => {
    if (!canAutoPlay || gameRef.current.status === 'ready') return;
    setBindingAction(null);
    setAutoSettingsRequested(true);
  }, [canAutoPlay]);
  const closeAutoSettings = useCallback(() => setAutoSettingsRequested(false), []);

  useEffect(() => {
    if (!autoEnabled || game.status !== 'playing') return;
    const timer = window.setInterval(() => {
      const source = gameRef.current;
      const player = source.mode === 'solo' ? 1 : localPlayerRef.current;
      if (source.status !== 'playing' || !player || bindingAction) return;
      if (source.mode !== 'solo' && socketRef.current?.readyState !== WebSocket.OPEN) return;
      if (shouldAutoFlush(source, autoSettings)) {
        sendCommand('frog_flush');
        return;
      }
      const plan = planAutoPlay(source, player, autoSettings);
      if (plan?.length) sendAction(player, plan[0]);
    }, getAutoActionInterval(autoSettings, game.mode));
    return () => window.clearInterval(timer);
  }, [autoEnabled, autoSettings, bindingAction, game.mode, game.status, sendAction, sendCommand]);

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
        setCoop({
          phase: 'hosting',
          roomCode: message.roomCode,
          playerId: 1,
          playerNames: getMessagePlayerNames(message.playerNames),
          error: '',
        });
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
        setCoop({
          phase: 'connected',
          roomCode: message.roomCode,
          playerId: 2,
          playerNames: getMessagePlayerNames(message.playerNames),
          error: '',
        });
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
        const restoredState = isGameState(message.state)
          ? message.state
          : initialGame(gameMode);
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
          playerNames: getMessagePlayerNames(message.playerNames),
          error: peerConnected ? '' : 'Your game was restored. Waiting for the other player to reconnect.',
        });
        publish(resumedState);
        return;
      }
      if (message.type === 'peer_joined' && localPlayerRef.current === 1) {
        setCoop((current) => ({
          ...current,
          phase: 'connected',
          playerNames: getMessagePlayerNames(message.playerNames),
          error: '',
        }));
        return;
      }
      if (message.type === 'game_state' && localPlayerRef.current && isGameState(message.state)) {
        publish(message.state);
        return;
      }
      if (message.type === 'peer_left' && localPlayerRef.current) {
        const peerName = gameRef.current.mode === 'duel' ? 'rival' : 'partner';
        const reconnecting = message.reconnecting !== false;
        setCoop((current) => ({
          ...current,
          phase: localPlayerRef.current === 1 ? 'hosting' : 'connected',
          error: reconnecting
            ? `Your ${peerName} refreshed or disconnected. Waiting for them to return.`
            : `Your ${peerName} left the room.`,
        }));
        return;
      }
      if (message.type === 'peer_rejoined') {
        setCoop((current) => ({
          ...current,
          phase: 'connected',
          playerNames: getMessagePlayerNames(message.playerNames),
          error: '',
        }));
        return;
      }
      if (message.type === 'peer_expired') {
        setCoop((current) => ({
          ...current,
          phase: 'hosting',
          playerNames: { ...current.playerNames, 2: null },
          error: 'Player 2 did not reconnect. The room is open for a new player.',
        }));
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
          playerNames: { 1: null, 2: null },
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
  }, [closeCoopSocket, publish]);

  useEffect(() => {
    if (!bindingAction) return;
    const onBindingKeyDown = (event: KeyboardEvent) => captureBinding(bindingAction, event);
    window.addEventListener('keydown', onBindingKeyDown, true);
    return () => window.removeEventListener('keydown', onBindingKeyDown, true);
  }, [bindingAction, captureBinding]);

  useEffect(() => {
    const held = new Map<string, { action: Action; nextRepeat: number }>();
    const clearHeld = () => held.clear();
    const sendMovement = (action: Action) => {
      const source = gameRef.current;
      const player = source.mode !== 'solo' ? localPlayerRef.current : 1;
      if (source.status === 'playing' && player) sendAction(player, action);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (autoSettingsOpen) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      const isModifierKey = [
        'ControlLeft',
        'ControlRight',
        'AltLeft',
        'AltRight',
        'MetaLeft',
        'MetaRight',
      ].includes(event.code);
      if (!isModifierKey && (event.ctrlKey || event.metaKey || event.altKey)) return;
      const action = KEYBOARD_ACTIONS.find((candidate) => keyBindings[candidate].code === event.code);
      if (!action) return;
      event.preventDefault();
      if (event.repeat || bindingAction) return;

      if (action === 'pause') {
        clearHeld();
        return sendCommand('toggle_pause');
      }
      if (action === 'restart') {
        clearHeld();
        if (gameRef.current.status !== 'ready') sendCommand('restart');
        return;
      }
      if (action === 'frogFlush') return sendCommand('frog_flush');
      if (gameRef.current.status !== 'playing') return;
      if (action === 'left' || action === 'right' || action === 'down') {
        held.set(event.code, { action, nextRepeat: performance.now() + MOVEMENT_REPEAT.delay });
      }
      sendMovement(action);
    };
    const onKeyUp = (event: KeyboardEvent) => held.delete(event.code);
    const onVisibility = () => { if (document.hidden) clearHeld(); };
    const timer = window.setInterval(() => {
      const target = document.activeElement;
      if (autoSettingsOpen || gameRef.current.status !== 'playing' || !document.hasFocus() || document.hidden
        || (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable))) {
        clearHeld();
        return;
      }
      const now = performance.now();
      held.forEach((input) => {
        if (now < input.nextRepeat) return;
        sendMovement(input.action);
        input.nextRepeat = now + MOVEMENT_REPEAT.interval;
      });
    }, 16);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeld);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoSettingsOpen, bindingAction, keyBindings, sendAction, sendCommand]);

  useEffect(() => {
    if (game.status !== 'playing') return;
    if (game.mode !== 'solo') return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(50, now - lastTick);
      lastTick = now;
      const source = gameRef.current;
      if (source.status !== 'playing' || source.mode !== 'solo') return;
      const piece = source.active[0];
      if (!piece) return;
      const timedPiece = advanceLock(piece, source, elapsed);
      const updated = { ...source, active: [timedPiece] };
      gameRef.current = updated;
      if (timedPiece.lockElapsed! >= LOCK_DELAY) {
        lockPiece(updated, piece.player);
        gravityElapsedRef.current = 0;
        return;
      }
      gravityElapsedRef.current += elapsed;
      const speed = Math.max(0, 820 * (32 - source.level) / 31);
      const steps = speed > 0 ? Math.min(ROWS, Math.floor(gravityElapsedRef.current / speed)) : ROWS;
      gravityElapsedRef.current = speed > 0 ? gravityElapsedRef.current % speed : 0;
      for (let step = 0; step < steps; step += 1) {
        const previousY = gameRef.current.active[0]?.y;
        movePlayer(piece.player, 'down');
        if (gameRef.current.active[0]?.y === previousY) break;
      }
    }, 16);
    return () => window.clearInterval(timer);
  }, [game.mode, game.status, lockPiece, movePlayer]);

  useEffect(() => {
    const saved = multiplayerSessionRef.current;
    if (!saved) return;
    connectToCoop('resume', saved.roomCode, saved.gameMode, saved.resumeToken, saved.game);
  }, [connectToCoop]);

  useEffect(() => () => closeCoopSocket(), [closeCoopSocket]);

  useEffect(() => {
    if (game.status !== 'gameover') return;
    const score = game.mode === 'duel'
      ? game.playerStats[coop.playerId || 1].score
      : game.score;
    if (game.mode === 'solo') soloBest.recordScore(score);
    if (game.mode === 'coop') coopBest.recordScore(score);
    if (game.mode === 'duel') duelBest.recordScore(score);
  }, [coop.playerId, coopBest, duelBest, game, soloBest]);

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

  const returnToMenu = useCallback(() => {
    setAutoUserId(null);
    const source = gameRef.current;
    if (source.mode !== 'solo') {
      leaveCoop();
      return;
    }
    publish({ ...initialGame('solo'), best: source.best });
  }, [leaveCoop, publish]);

  return {
    game,
    bestScores: {
      solo: soloBest.bestScore,
      coop: coopBest.bestScore,
      duel: duelBest.bestScore,
    },
    coop,
    joinCode,
    setJoinCode,
    keyBindings,
    bindingAction,
    setBindingAction,
    resetBindings,
    startSolo,
    connectToCoop,
    leaveCoop,
    sendAction,
    sendCommand,
    renderedBoards,
    returnToMenu,
    soundEnabled,
    toggleSound,
    canAutoPlay,
    autoEnabled,
    toggleAuto,
    autoSettings,
    autoSettingsSaveError,
    updateAutoSettings,
    autoSettingsOpen,
    openAutoSettings,
    closeAutoSettings,
  };
}

export default function TetrisPage() {
  return <TetrisGame controller={useTetrisGame()} />;
}
