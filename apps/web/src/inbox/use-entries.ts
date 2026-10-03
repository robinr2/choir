import { use, useDeferredValue } from 'react';
import { listPath } from './core-inbox';
import { useInbox } from './inbox-context';
import type { ListKind } from './core-inbox';
import type { ListSettings } from './list-settings';

export function useEntries<T>(
  kind: ListKind,
  { search, archived }: ListSettings,
): T[] {
  const { inbox, snapshot } = useInbox();
  const path = useDeferredValue(
    listPath(kind, { archived, search: search.trim() }),
  );
  const revision = useDeferredValue(snapshot.revision);
  return use(inbox.read<T[]>(path, revision));
}
