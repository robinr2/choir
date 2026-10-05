import { createContext, use } from 'react';
import type { CoreRateLimits } from './core-rate-limits';

export const RateLimitsContext = createContext<CoreRateLimits | null>(null);

export function useRateLimits(): CoreRateLimits {
  const rateLimits = use(RateLimitsContext);
  if (!rateLimits) throw new Error('useRateLimits needs a RateLimitsContext');
  return rateLimits;
}
