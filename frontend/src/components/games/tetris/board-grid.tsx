import { PIECE_COLORS, PLAYER_COLORS } from './constants';
import type { RenderedCell } from './types';

type BoardGridProps = {
  cells: Map<string, RenderedCell>;
  cols: number;
  rows: number;
  width: string;
  height: string;
  accent: string;
  label: string;
};

export function BoardGrid({ cells, cols, rows, width, height, accent, label }: BoardGridProps) {
  return (
    <div>
      {label && <p className="mb-2 text-center text-[9px]" style={{ color: accent }}>{label}</p>}
      <div
        className="grid overflow-hidden rounded-xl border-2 bg-[#020704] p-1 shadow-[0_0_60px_rgba(118,255,76,0.08)] transition-[height] duration-700 ease-out motion-reduce:transition-none"
        style={{
          width,
          height,
          borderColor: `${accent}55`,
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: '1px',
        }}
      >
        {Array.from({ length: rows * cols }, (_, index) => {
          const x = index % cols;
          const y = Math.floor(index / cols);
          const rendered = cells.get(`${x}:${y}`);
          const color = rendered ? PIECE_COLORS[rendered.cell.type] : undefined;
          const ownerColor = rendered ? PLAYER_COLORS[rendered.cell.owner] : undefined;
          return (
            <span
              key={index}
              className="rounded-xs bg-white/2.5"
              style={rendered ? {
                background: rendered.ghost ? `${color}1f` : color,
                border: rendered.ghost ? `1px solid ${color}65` : undefined,
                boxShadow: rendered.active
                  ? `inset 0 0 0 2px ${ownerColor}, inset 2px 2px 0 rgba(255,255,255,.3)`
                  : `inset 0 0 0 1px ${ownerColor}90, inset 2px 2px 0 rgba(255,255,255,.18)`,
                opacity: rendered.ghost ? 0.8 : 1,
              } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
