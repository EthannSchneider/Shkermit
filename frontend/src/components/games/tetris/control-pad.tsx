import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef } from 'react';
import { MOVEMENT_REPEAT } from './constants';
import type { Action, KeyboardBindings, PlayerId } from './types';

type ControlPadProps = {
  player: PlayerId;
  bindings: KeyboardBindings;
  onAction: (player: PlayerId, action: Action) => void;
  disabled?: boolean;
};

const controls: { action: Action; symbol: string; label: string }[] = [
  { action: 'left', symbol: '←', label: 'move left' },
  { action: 'rotate', symbol: '↻', label: 'rotate' },
  { action: 'rotate_ccw', symbol: '↺', label: 'rotate counterclockwise' },
  { action: 'down', symbol: '↓', label: 'move down' },
  { action: 'right', symbol: '→', label: 'move right' },
  { action: 'drop', symbol: 'DROP', label: 'hard drop' },
  { action: 'hold', symbol: 'HOLD', label: 'hold piece' },
];

export function ControlPad({ player, bindings, onAction, disabled = false }: ControlPadProps) {
  const { t } = useTranslation();
  const held = useRef(new Map<number, { delay: number; repeat?: number }>());
  const stop = useCallback((pointerId?: number) => {
    held.current.forEach((timers, id) => {
      if (pointerId !== undefined && pointerId !== id) return;
      window.clearTimeout(timers.delay);
      window.clearInterval(timers.repeat);
      held.current.delete(id);
    });
  }, []);

  useEffect(() => {
    const clear = () => stop();
    const onVisibility = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clear();
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [disabled, onAction, player, stop]);

  const buttonClass = 'game-touch-button flex min-w-12 flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-white active:scale-95 active:bg-white/20 disabled:opacity-35';
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-label={t("Player {{value1}} touch controls", { value1: player })}>
      {controls.map(({ action, symbol, label }) => (
        <button
          type="button"
          key={action}
          disabled={disabled}
          className={buttonClass}
          onPointerDown={(event) => {
            if (event.button !== 0 || disabled) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            onAction(player, action);
            if (action !== 'left' && action !== 'right' && action !== 'down') return;
            stop(event.pointerId);
            const timers = { delay: 0, repeat: undefined as number | undefined };
            timers.delay = window.setTimeout(() => {
              onAction(player, action);
              timers.repeat = window.setInterval(() => onAction(player, action), MOVEMENT_REPEAT.interval);
            }, MOVEMENT_REPEAT.delay);
            held.current.set(event.pointerId, timers);
          }}
          onPointerUp={(event) => stop(event.pointerId)}
          onPointerCancel={(event) => stop(event.pointerId)}
          onLostPointerCapture={(event) => stop(event.pointerId)}
          onClick={(event) => { if (event.detail === 0) onAction(player, action); }}
          onContextMenu={(event) => event.preventDefault()}
          aria-label={t("Player {{value1}} {{value2}}, keyboard key {{value3}}", { value1: player, value2: t(label), value3: bindings[action].label })}
        >
          <span className={action === 'drop' || action === 'hold' ? 'text-[10px]' : 'text-lg'} aria-hidden="true">{t(symbol)}</span>
          <span className="max-w-14 truncate text-[8px] text-lime-200/70">{t(bindings[action].label)}</span>
        </button>
      ))}
    </div>
  );
}
