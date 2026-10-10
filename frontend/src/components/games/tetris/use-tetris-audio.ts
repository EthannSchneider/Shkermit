import { useCallback, useEffect, useRef, useState } from 'react';
import menuMusic from '../../../assets/sound/tetris/musics/menu.wav';
import gameMusic from '../../../assets/sound/tetris/musics/tetwis.wav';
import lineSound from '../../../assets/sound/tetris/scnenes/line.mp3';
import placeSound from '../../../assets/sound/tetris/scnenes/place.wav';
import type { GameState } from './types';
import { applySoundSettings, getSavedSoundSettings, normalizeSoundSettings, SOUND_SETTINGS_STORAGE_KEY, type SoundSettings } from './sound-settings';

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
  const [soundSettings, setSoundSettings] = useState(getSavedSoundSettings);
  const [soundSettingsSaveError, setSoundSettingsSaveError] = useState('');
  const musicEnabled = !soundSettings.muted && soundSettings.masterVolume > 0 && soundSettings.musicVolume > 0;
  const audioRef = useRef<TetrisAudio | null>(null);
  const previousGameRef = useRef(game);

  const play = useCallback((audio: HTMLAudioElement) => {
    if (audio.muted || audio.volume === 0) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const syncMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!musicEnabled) {
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
  }, [game.status, musicEnabled]);

  useEffect(() => {
    const audio: TetrisAudio = {
      menu: new Audio(menuMusic),
      game: new Audio(gameMusic),
      place: new Audio(placeSound),
      line: new Audio(lineSound),
    };
    audio.menu.loop = true;
    audio.game.loop = true;
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
    if (audioRef.current) applySoundSettings(audioRef.current, soundSettings);
  }, [soundSettings]);

  useEffect(() => {
    syncMusic();
  }, [syncMusic]);

  // Browsers can block music until the first user gesture. Retry once the player
  // interacts with the page, while keeping normal status changes declarative.
  useEffect(() => {
    if (!musicEnabled) return;
    const unlockAudio = () => syncMusic();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [musicEnabled, syncMusic]);

  // Multiplayer gameplay is authoritative on the server, so infer its audio
  // events from state changes received over the socket.
  useEffect(() => {
    const previous = previousGameRef.current;
    previousGameRef.current = game;
    if (game.mode === 'solo' || previous.mode !== game.mode) return;
    if (previous.status !== 'playing' || game.status === 'ready') return;

    const audio = audioRef.current;
    if (!audio) return;
    if (totalLines(game) > totalLines(previous)) {
      play(audio.line);
    } else if (countLockedCells(game) > countLockedCells(previous)) {
      play(audio.place);
    }
  }, [game, play]);

  const playLockSound = useCallback((linesCleared: number) => {
    if (!audioRef.current) return;
    play(linesCleared > 0 ? audioRef.current.line : audioRef.current.place);
  }, [play]);

  const updateSoundSettings = useCallback((settings: SoundSettings) => {
    const normalized = normalizeSoundSettings(settings);
    if (audioRef.current) applySoundSettings(audioRef.current, normalized);
    setSoundSettings(normalized);
    try {
      window.localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
      setSoundSettingsSaveError('');
    } catch {
      setSoundSettingsSaveError('Sound changes apply now, but could not be saved on this device.');
    }
  }, []);

  return { soundSettings, soundSettingsSaveError, updateSoundSettings, playLockSound };
}
