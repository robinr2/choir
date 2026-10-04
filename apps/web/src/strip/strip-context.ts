import { createContext, use } from 'react';
import type { Store } from './types';

export const StripContext = createContext<Store | null>(null);

export function useStrip(): Store {
  const store = use(StripContext);
  if (!store) throw new Error('useStrip needs a StripContext');
  return store;
}
