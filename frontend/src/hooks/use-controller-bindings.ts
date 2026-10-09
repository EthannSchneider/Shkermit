import { useState } from 'react';
import { controllerStorageKey, defaultControllerBindings, parseControllerBindings, rebindControllerAction } from '../lib/controller-bindings';
import type { ControllerGame } from '../lib/controller-bindings';
import type { GamepadBindings, GamepadControl, GamepadInputControl } from '../lib/gamepad';

export function useControllerBindings(game: ControllerGame) {
  const [bindings, setBindings] = useState(() => {
    try {
      return parseControllerBindings(window.localStorage.getItem(controllerStorageKey(game)));
    } catch {
      return defaultControllerBindings();
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capturing, setCapturing] = useState<GamepadControl | null>(null);
  const [saveError, setSaveError] = useState('');

  const save = (next: GamepadBindings) => {
    setBindings(next);
    try {
      window.localStorage.setItem(controllerStorageKey(game), JSON.stringify(next));
      setSaveError('');
    } catch {
      setSaveError('These controls work now, but this browser could not save them for next time.');
    }
  };
  const rebind = (action: GamepadControl, input: GamepadInputControl) => {
    save(rebindControllerAction(bindings, action, input));
    setCapturing(null);
  };

  return {
    game, bindings, settingsOpen, capturing, saveError,
    setCapturing, rebind,
    open: () => setSettingsOpen(true),
    close: () => { setSettingsOpen(false); setCapturing(null); },
    reset: () => { save(defaultControllerBindings()); setCapturing(null); },
    onCapture: capturing ? (input: GamepadInputControl) => rebind(capturing, input) : undefined,
  };
}

export type ControllerSettingsState = ReturnType<typeof useControllerBindings>;
