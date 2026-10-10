import type { GameMode } from './types';

export type AutoPlayStyle = 'balanced' | 'safe' | 'aggressive';
export type AutoPlaySettings = {
  actionsPerSecond: number;
  playStyle: AutoPlayStyle;
  lookAhead: boolean;
  autoFlush: boolean;
};

export const DEFAULT_AUTO_SETTINGS: AutoPlaySettings = {
  actionsPerSecond: 8,
  playStyle: 'balanced',
  lookAhead: true,
  autoFlush: false,
};

export const AUTO_SETTINGS_STORAGE_KEY = 'shkermitStacksAutoSettings';

export function normalizeAutoSettings(value: unknown): AutoPlaySettings {
  const settings = value && typeof value === 'object' ? value as Partial<AutoPlaySettings> : {};
  return {
    actionsPerSecond: typeof settings.actionsPerSecond === 'number' && Number.isFinite(settings.actionsPerSecond)
      ? Math.max(1, Math.min(20, Math.round(settings.actionsPerSecond))) : DEFAULT_AUTO_SETTINGS.actionsPerSecond,
    playStyle: ['balanced', 'safe', 'aggressive'].includes(settings.playStyle ?? '')
      ? settings.playStyle! : DEFAULT_AUTO_SETTINGS.playStyle,
    lookAhead: typeof settings.lookAhead === 'boolean' ? settings.lookAhead : DEFAULT_AUTO_SETTINGS.lookAhead,
    autoFlush: typeof settings.autoFlush === 'boolean' ? settings.autoFlush : DEFAULT_AUTO_SETTINGS.autoFlush,
  };
}

export function getSavedAutoSettings(): AutoPlaySettings {
  try {
    if (typeof window === 'undefined') return { ...DEFAULT_AUTO_SETTINGS };
    return normalizeAutoSettings(JSON.parse(window.localStorage.getItem(AUTO_SETTINGS_STORAGE_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_AUTO_SETTINGS };
  }
}

export function getAutoActionInterval(settings: AutoPlaySettings, mode: GameMode) {
  const speed = normalizeAutoSettings(settings).actionsPerSecond;
  return Math.max(mode === 'solo' ? 50 : 100, Math.round(1000 / speed));
}
