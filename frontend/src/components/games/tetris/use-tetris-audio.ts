import { useCallback, useEffect, useRef, useState } from 'react';
import menuMusic from '../../../assets/sound/tetris/musics/menu.wav';
import gameMusic from '../../../assets/sound/tetris/musics/tetwis.wav';
import lineSound from '../../../assets/sound/tetris/scnenes/line.mp3';
import placeSound from '../../../assets/sound/tetris/scnenes/place.wav';
import type { GameState } from './types';

const SOUND_PREFERENCE_KEY = 'shkermitStacksSoundEnabled';

type TetrisAudio = {
  menu: HTMLAudioElement;
  game: HTMLAudioElement;
  place: HTMLAudioElement;
  line: HTMLAudioElement;
};

const countLockedCells = (game: GameState) => {
  const boards = game.mode === 'duel' && game.duelBoards
    ? [game.duelBoards[1], game.duelBoards[2]]
    : [game.board];
  return boards.reduce(
    (total, board) => total + board.reduce(
      (boardTotal, row) => boardTotal + row.filter(Boolean).length,
      0,
    ),
    0,
  );
};

const totalLines = (game: GameState) => game.mode === 'duel'
  ? game.playerStats[1].lines + game.playerStats[2].lines
  : game.lines;

export function useTetrisAudio(game: GameState) {
  const [soundEnabled, setSoundEnabled] = useState(() => (
    window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'false'
  ));
  const audioRef = useRef<TetrisAudio | null>(null);
  const previousGameRef = useRef(game);

  const play = useCallback((audio: HTMLAudioElement) => {
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const syncMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!soundEnabled) {
      audio.menu.pause();
      audio.game.pause();
      return;
    }

    const target = game.status === 'ready'
      ? audio.menu
      : game.status === 'playing' ? audio.game : null;
    const other = target === audio.menu ? audio.game : audio.menu;
    other.pause();
    other.currentTime = 0;

    if (target) {
      void target.play().catch(() => undefined);
    } else {
      audio.game.pause();
      if (game.status === 'gameover') audio.game.currentTime = 0;
    }
  }, [game.status, soundEnabled]);

  useEffect(() => {
    const audio: TetrisAudio = {
      menu: new Audio(menuMusic),
      game: new Audio(gameMusic),
      place: new Audio(placeSound),
      line: new Audio(lineSound),
    };
    audio.menu.loop = true;
    audio.game.loop = true;
    audio.menu.volume = 0.28;
    audio.game.volume = 0.28;
    audio.place.volume = 0.55;
    audio.line.volume = 0.65;
    Object.values(audio).forEach((track) => { track.preload = 'auto'; });
    audioRef.current = audio;

    return () => {
      Object.values(audio).forEach((track) => {
        track.pause();
        track.removeAttribute('src');
        track.load();
      });
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    syncMusic();
  }, [syncMusic]);

  // Browsers can block music until the first user gesture. Retry once the player
  // interacts with the page, while keeping normal status changes declarative.
  useEffect(() => {
    if (!soundEnabled) return;
    const unlockAudio = () => syncMusic();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [soundEnabled, syncMusic]);

  // Multiplayer gameplay is authoritative on the server, so infer its audio
  // events from state changes received over the socket.
  useEffect(() => {
    const previous = previousGameRef.current;
    previousGameRef.current = game;
    if (!soundEnabled || game.mode === 'solo' || previous.mode !== game.mode) return;
    if (previous.status !== 'playing' || game.status === 'ready') return;

    const audio = audioRef.current;
    if (!audio) return;
    if (totalLines(game) > totalLines(previous)) {
      play(audio.line);
    } else if (countLockedCells(game) > countLockedCells(previous)) {
      play(audio.place);
    }
  }, [game, play, soundEnabled]);

  const playLockSound = useCallback((linesCleared: number) => {
    if (!soundEnabled || !audioRef.current) return;
    play(linesCleared > 0 ? audioRef.current.line : audioRef.current.place);
  }, [play, soundEnabled]);

  const toggleSound = useCallback(() => {
    const nextEnabled = !soundEnabled;
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(nextEnabled));
    setSoundEnabled(nextEnabled);
    const audio = audioRef.current;
    if (!audio) return;
    if (nextEnabled) {
      const target = game.status === 'ready' ? audio.menu : game.status === 'playing' ? audio.game : null;
      if (target) void target.play().catch(() => undefined);
    } else {
      audio.menu.pause();
      audio.game.pause();
      audio.place.pause();
      audio.line.pause();
    }
  }, [game.status, soundEnabled]);

  return { soundEnabled, toggleSound, playLockSound };
}
