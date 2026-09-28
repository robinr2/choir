import { useReducer } from 'react';
import type { Sort } from './inbox-sort';

export type ListSettings = { search: string; archived: boolean; sort: Sort };

const INITIAL: ListSettings = {
  search: '',
  archived: false,
  sort: { field: 'position', direction: 'asc' },
};

function merged(
  settings: ListSettings,
  change: Partial<ListSettings>,
): ListSettings {
  return { ...settings, ...change };
}

export function useListSettings() {
  return useReducer(merged, INITIAL);
}
