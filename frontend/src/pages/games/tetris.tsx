import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TetrisGame from '../../components/games/tetris/tetris-game';
import {
  COOP_COLS,
  DEFAULT_BINDINGS,
  KEY_BINDINGS_STORAGE_KEY,
  KEYBOARD_ACTIONS,
  PIECES,
  ROWS,
  SOLO_COLS,
} from '../../components/games/tetris/constants';
import {
  getCells,
  getCollidingPieces,
  getGhost,
  getPlayerBoard,
  isValid,
  makeBoard,
  spawnPiece,
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
  const [game, setGame] = useState<GameState>(initialGame);
  const [coop, setCoop] = useState<CoopState>(initialCoop);
  const soloBest = useBestScore('tetris', 'solo', getSavedBest('solo'));
  const coopBest = useBestScore('tetris', 'coop', getSavedBest('coop'), false);
  const duelBest = useBestScore('tetris', 'duel', getSavedBest('duel'), false);
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

  const publish = useCallback((nextGame: GameState) => {
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
    const onKeyDown = (event: KeyboardEvent) => {
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
    if (game.mode !== 'solo') return;
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
  };
}

export default function TetrisPage() {
  return <TetrisGame controller={useTetrisGame()} />;
}
