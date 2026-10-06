import { PIECE_COLORS, PLAYER_COLORS } from './constants';
import { getCells } from './game-logic';
import type { PieceName, PlayerId } from './types';

type MiniPieceProps = {
  type: PieceName;
  player: PlayerId;
};

export function MiniPiece({ type, player }: MiniPieceProps) {
  const occupied = new Set(
    getCells({ type, player, rotation: 0, x: 0, y: 0 }).map(({ x, y }) => `${x}:${y}`),
  );

  return (
    <div className="grid h-16 w-16 grid-cols-4 grid-rows-4 gap-0.5" aria-label={`Next piece: ${type}`}>
      {Array.from({ length: 16 }, (_, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        const filled = occupied.has(`${x}:${y}`);
        return (
          <span
            key={index}
            className="rounded-xs"
            style={filled ? {
              background: PIECE_COLORS[type],
              boxShadow: `inset 0 0 0 1px ${PLAYER_COLORS[player]}`,
            } : undefined}
          />
        );
      })}
    </div>
  );
}
