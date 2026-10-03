export type SortField =
  'position' | 'sentAt' | 'dueAt' | 'createdAt' | 'updatedAt';

export type Direction = 'asc' | 'desc';

export type Sort = { field: SortField; direction: Direction };

export const SORT_LABELS: Record<SortField, string> = {
  position: 'My order',
  sentAt: 'Arrival time',
  dueAt: 'Due date',
  createdAt: 'Created',
  updatedAt: 'Last change',
};

type Sortable = Partial<Record<SortField, string | null>>;

type Time = string | null | undefined;

function compare(first: Time, second: Time, direction: Direction): number {
  if (!first) return second ? 1 : 0;
  if (!second) return -1;
  const difference = Date.parse(first) - Date.parse(second);
  return direction === 'asc' ? difference : -difference;
}

export function sorted<T extends Sortable>(
  entries: readonly T[],
  { field, direction }: Sort,
): T[] {
  return entries.toSorted((first, second) =>
    compare(first[field], second[field], direction),
  );
}
