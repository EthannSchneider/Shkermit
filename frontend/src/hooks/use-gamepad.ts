import { useEffect, useEffectEvent, useState } from 'react';
import { DEFAULT_GAMEPAD_BINDINGS, GamepadCapture, GamepadInput, selectGamepad } from '../lib/gamepad';
import type { ControllerStatus, GamepadBindings, GamepadControl, GamepadInputControl, GamepadRepeatTiming } from '../lib/gamepad';

type GamepadOptions = {
  onControl: (control: GamepadControl) => void;
  repeat?: readonly GamepadControl[];
  repeatTiming?: GamepadRepeatTiming;
  enabled?: boolean;
  bindings?: GamepadBindings;
  onCapture?: (input: GamepadInputControl) => void;
};

export function useGamepad({ onControl, repeat = [], repeatTiming, enabled = true, bindings = DEFAULT_GAMEPAD_BINDINGS, onCapture }: GamepadOptions): ControllerStatus {
  const [status, setStatus] = useState<ControllerStatus>({ state: 'waiting' });
  const sample = useEffectEvent((input: GamepadInput, capture: GamepadCapture, pad: Gamepad | null, now: number, focused: boolean) => {
    const target = document.activeElement;
    const editing = target instanceof HTMLElement && (
      target.matches('input, textarea, select') || target.isContentEditable
    );
    const active = focused && !editing;
    const actions = input.sample(pad, now, enabled && active && !onCapture, repeat, bindings, repeatTiming);
    if (onCapture) {
      const captured = capture.sample(pad, active);
      if (captured) onCapture(captured);
    } else {
      capture.reset();
      actions.forEach(onControl);
    }
  });
  const suppress = useEffectEvent((input: GamepadInput, pad: Gamepad | null) => {
    input.sample(pad, performance.now(), false, [], bindings);
  });

  useEffect(() => {
    const input = new GamepadInput();
    const capture = new GamepadCapture();
    let activeIndex: number | null = null;
    let frame = 0;
    let focused = document.hasFocus();
    let lastStatus = '';
    const publishStatus = (next: ControllerStatus) => {
      const signature = `${next.state}:${next.name ?? ''}`;
      if (signature !== lastStatus) {
        lastStatus = signature;
        setStatus(next);
      }
    };
    const poll = (now: number) => {
      let pads: (Gamepad | null)[];
      try {
        if (typeof navigator.getGamepads !== 'function') throw new Error('Gamepad API unavailable');
        pads = Array.from(navigator.getGamepads());
      } catch {
        publishStatus({ state: 'unavailable' });
        return;
      }
      const pad = selectGamepad(pads, activeIndex);
      activeIndex = pad?.index ?? null;
      const unmapped = pads.find((candidate) => candidate?.connected);
      publishStatus(pad
        ? { state: 'connected', name: pad.id }
        : unmapped ? { state: 'unsupported', name: unmapped.id } : { state: 'waiting' });
      sample(input, capture, pad, now, focused && document.visibilityState === 'visible');
      frame = requestAnimationFrame(poll);
    };
    const suppressHeldInputs = () => {
      try {
        suppress(input, selectGamepad(Array.from(navigator.getGamepads()), activeIndex));
      } catch {
        suppress(input, null);
      }
    };
    const onBlur = () => {
      focused = false;
      capture.reset();
      // rAF may stop in a background tab. Suppress held inputs immediately.
      suppressHeldInputs();
    };
    const onFocus = () => {
      // Also suppress buttons first pressed while background polling stopped.
      suppressHeldInputs();
      focused = true;
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') onBlur();
      else if (document.hasFocus()) onFocus();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return status;
}
