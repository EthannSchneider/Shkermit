import type { Action, KeyboardBindings, PlayerId } from './types';

type ControlPadProps = {
  player: PlayerId;
  bindings: KeyboardBindings;
  onAction: (player: PlayerId, action: Action) => void;
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

export function ControlPad({ player, bindings, onAction }: ControlPadProps) {
  const buttonClass = 'flex min-w-12 select-none flex-col items-center gap-1 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-white active:scale-95 active:bg-white/20';
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-label={`Player ${player} touch controls`}>
      {controls.map(({ action, symbol, label }) => (
        <button
          key={action}
          className={buttonClass}
          onPointerDown={() => onAction(player, action)}
          aria-label={`Player ${player} ${label}, keyboard key ${bindings[action].label}`}
        >
          <span className={action === 'drop' || action === 'hold' ? 'text-[10px]' : 'text-lg'} aria-hidden="true">{symbol}</span>
          <span className="max-w-14 truncate text-[8px] text-lime-200/70">{bindings[action].label}</span>
        </button>
      ))}
    </div>
  );
}
