export type SoundSettings = {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
};

export const SOUND_SETTINGS_STORAGE_KEY = 'shkermitStacksSoundSettings';
export const LEGACY_SOUND_PREFERENCE_KEY = 'shkermitStacksSoundEnabled';
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  muted: false,
  masterVolume: 100,
  musicVolume: 28,
  effectsVolume: 65,
};

export function normalizeSoundSettings(value: unknown): SoundSettings {
  const settings = value && typeof value === 'object' ? value as Partial<SoundSettings> : {};
  const volume = (input: unknown, fallback: number) => typeof input === 'number' && Number.isFinite(input)
    ? Math.max(0, Math.min(100, Math.round(input))) : fallback;
  return {
    muted: typeof settings.muted === 'boolean' ? settings.muted : DEFAULT_SOUND_SETTINGS.muted,
    masterVolume: volume(settings.masterVolume, DEFAULT_SOUND_SETTINGS.masterVolume),
    musicVolume: volume(settings.musicVolume, DEFAULT_SOUND_SETTINGS.musicVolume),
    effectsVolume: volume(settings.effectsVolume, DEFAULT_SOUND_SETTINGS.effectsVolume),
  };
}

export function getSavedSoundSettings(): SoundSettings {
  try {
    if (typeof window === 'undefined') return { ...DEFAULT_SOUND_SETTINGS };
    const stored = window.localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return normalizeSoundSettings(parsed);
      } catch { /* Fall back to the existing mute preference. */ }
    }
    return { ...DEFAULT_SOUND_SETTINGS, muted: window.localStorage.getItem(LEGACY_SOUND_PREFERENCE_KEY) === 'false' };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

type AudioTrack = Pick<HTMLAudioElement, 'volume' | 'muted' | 'pause'>;
export function applySoundSettings(audio: Record<'menu' | 'game' | 'place' | 'line', AudioTrack>, settings: SoundSettings) {
  const normalized = normalizeSoundSettings(settings);
  const master = normalized.masterVolume / 100;
  const music = master * normalized.musicVolume / 100;
  const effects = master * normalized.effectsVolume / 100;
  audio.menu.volume = music;
  audio.game.volume = music;
  audio.place.volume = effects * (0.55 / 0.65);
  audio.line.volume = effects;
  for (const track of Object.values(audio)) {
    track.muted = normalized.muted || track.volume === 0;
    if (track.muted) track.pause();
  }
}
