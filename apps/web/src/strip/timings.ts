function spring(stiffness: number) {
  return {
    type: 'spring',
    stiffness,
    damping: 2 * Math.sqrt(stiffness),
    mass: 1,
  } as const;
}

function easeOutExpo(progress: number): number {
  return progress >= 1 ? 1 : 1 - 2 ** (-10 * progress);
}

function easeOutQuad(progress: number): number {
  return 1 - (1 - progress) ** 2;
}

export const WORKSPACE = { ...spring(1000), restDelta: 0.0001 };

export const VIEW = spring(800);

export const OVERVIEW = { ...spring(800), restDelta: 0.0001 };

export const MOVE = spring(800);

export const RESIZE = spring(800);

export const SHEET = spring(800);

export const OPEN = { duration: 0.15, ease: easeOutExpo };

export const CLOSE = { duration: 0.15, ease: easeOutQuad };
