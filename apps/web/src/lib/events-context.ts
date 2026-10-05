import { createContext, use } from 'react';
import type { CoreEvents } from './core-events';

export const EventsContext = createContext<CoreEvents | null>(null);

export function useEvents(): CoreEvents {
  const events = use(EventsContext);
  if (!events) throw new Error('useEvents needs an EventsContext');
  return events;
}
