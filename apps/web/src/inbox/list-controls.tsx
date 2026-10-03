import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from 'react';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  type Direction,
  SORT_LABELS,
  type Sort,
  type SortField,
} from './inbox-sort';
import type { ListSettings } from './list-settings';

type SortProps = Readonly<{ sort: Sort; onChange: (sort: Sort) => void }>;

const TRIGGER = <Button variant="outline" size="sm" aria-label="Sort" />;

const MANUAL_ICON = <ArrowUpDownIcon aria-hidden />;

const ASCENDING_ICON = <ArrowUpIcon aria-label="ascending" />;

const DESCENDING_ICON = <ArrowDownIcon aria-label="descending" />;

function sortIcon({ field, direction }: Sort) {
  if (field === 'position') return MANUAL_ICON;
  return direction === 'asc' ? ASCENDING_ICON : DESCENDING_ICON;
}

function FieldChoice({
  fields,
  sort,
  onChange,
}: SortProps & { fields: readonly SortField[] }) {
  const pick = useCallback(
    (field: SortField) => onChange({ ...sort, field }),
    [onChange, sort],
  );
  return (
    <DropdownMenuRadioGroup value={sort.field} onValueChange={pick}>
      {(['position', ...fields] as const).map((field) => (
        <DropdownMenuRadioItem key={field} value={field}>
          {SORT_LABELS[field]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

function DirectionChoice({ sort, onChange }: SortProps) {
  const pick = useCallback(
    (direction: Direction) => onChange({ ...sort, direction }),
    [onChange, sort],
  );
  const manual = sort.field === 'position';
  return (
    <DropdownMenuRadioGroup value={sort.direction} onValueChange={pick}>
      <DropdownMenuRadioItem value="asc" disabled={manual}>
        Ascending
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="desc" disabled={manual}>
        Descending
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}

function SortMenu({
  fields,
  sort,
  onChange,
}: SortProps & { fields: readonly SortField[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={TRIGGER}>
        {sortIcon(sort)}
        {SORT_LABELS[sort.field]}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <FieldChoice fields={fields} sort={sort} onChange={onChange} />
        <DropdownMenuSeparator />
        <DirectionChoice sort={sort} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Change = (change: Partial<ListSettings>) => void;

function ArchivedToggle({
  archived,
  change,
}: Readonly<{ archived: boolean; change: Change }>) {
  const id = useId();
  const [toggle] = useState(
    () => (next: boolean) => change({ archived: next }),
  );
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <Switch id={id} checked={archived} onCheckedChange={toggle} />
      <label htmlFor={id}>Show archived</label>
    </div>
  );
}

function SearchBox({
  noun,
  search,
  change,
}: Readonly<{ noun: string; search: string; change: Change }>) {
  const [type] = useState(
    () => (event: ChangeEvent<HTMLInputElement>) =>
      change({ search: event.target.value }),
  );
  return (
    <Input
      type="search"
      aria-label={`Search ${noun}`}
      placeholder="Search"
      value={search}
      onChange={type}
    />
  );
}

export function ListControls({
  noun,
  fields,
  settings,
  change,
  children,
}: Readonly<{
  noun: string;
  fields: readonly SortField[];
  settings: ListSettings;
  change: Change;
  children?: ReactNode;
}>) {
  const [sort] = useState(() => (next: Sort) => change({ sort: next }));
  return (
    <div className="border-border/60 flex flex-col gap-2 border-b p-2">
      <div className="flex gap-2">
        <SearchBox noun={noun} search={settings.search} change={change} />
        {children}
      </div>
      <div className="flex items-center justify-between gap-2">
        <SortMenu fields={fields} sort={settings.sort} onChange={sort} />
        <ArchivedToggle archived={settings.archived} change={change} />
      </div>
    </div>
  );
}
