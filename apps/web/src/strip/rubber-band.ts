export type RubberBand = { stiffness: number; limit: number };

export function band({ stiffness, limit }: RubberBand, x: number): number {
  return (1 - 1 / ((x * stiffness) / limit + 1)) * limit;
}

export function bandClamp(
  rubberBand: RubberBand,
  [min, max]: readonly [number, number],
  x: number,
): number {
  const clamped = Math.min(Math.max(x, min), max);
  const beyond = x - clamped;
  return clamped + Math.sign(beyond) * band(rubberBand, Math.abs(beyond));
}
