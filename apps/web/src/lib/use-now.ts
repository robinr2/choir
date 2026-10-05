import { useEffect, useState } from 'react';

const TICK = 1000;

function tick(setNow: (now: number) => void): () => void {
  const timer = setInterval(() => setNow(Date.now()), TICK);
  return () => clearInterval(timer);
}

export function useNow(ticking: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => (ticking ? tick(setNow) : undefined), [ticking]);
  return now;
}
