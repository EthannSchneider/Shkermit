import type { Action, PlayerId } from './types';

type ControlPadProps = {
  player: PlayerId;
  onAction: (player: PlayerId, action: Action) => void;
};

export function ControlPad({ player, onAction }: ControlPadProps) {
  const buttonClass = 'select-none rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-lg text-white active:scale-95 active:bg-white/20';
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Player ${player} touch controls`}>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'left')} aria-label={`Player ${player} move left`}>←</button>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'rotate')} aria-label={`Player ${player} rotate`}>↻</button>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'down')} aria-label={`Player ${player} move down`}>↓</button>
      <button className={buttonClass} onPointerDown={() => onAction(player, 'right')} aria-label={`Player ${player} move right`}>→</button>
      <button className={`${buttonClass} text-xs`} onPointerDown={() => onAction(player, 'drop')} aria-label={`Player ${player} hard drop`}>DROP</button>
    </div>
  );
}
