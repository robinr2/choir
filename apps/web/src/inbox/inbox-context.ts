import { createContext, use, useSyncExternalStore } from 'react';
import type { CoreInbox, InboxSnapshot } from './core-inbox';
import type { NotificationSummary } from './core-inbox';

export type Overlay =
  | { kind: 'notification'; id: string }
  | { kind: 'todo'; id: string }
  | { kind: 'new-todo'; from?: NotificationSummary };

export const InboxContext = createContext<CoreInbox | null>(null);

export const OverlayContext = createContext<
  ((overlay: Overlay) => void) | null
>(null);

export function useInbox(): { inbox: CoreInbox; snapshot: InboxSnapshot } {
  const inbox = use(InboxContext);
  if (!inbox) throw new Error('useInbox needs an InboxContext');
  const snapshot = useSyncExternalStore(inbox.subscribe, inbox.getSnapshot);
  return { inbox, snapshot };
}

export function useOverlay(): (overlay: Overlay) => void {
  const show = use(OverlayContext);
  if (!show) throw new Error('useOverlay needs an OverlayContext');
  return show;
}
