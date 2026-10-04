import type { Rect } from './types';

function placedAt(rect: Rect) {
  return {
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: rect.width,
    height: rect.height,
  };
}

export function InsertHint({ rect }: Readonly<{ rect: Rect }>) {
  return (
    <div
      data-slot="insert-hint"
      className="border-ring bg-ring/25 pointer-events-none absolute top-0 left-0 z-10 rounded-lg border-2"
      style={placedAt(rect)}
    />
  );
}
