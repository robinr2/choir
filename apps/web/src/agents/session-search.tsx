import { type ChangeEvent, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SessionSearch({
  query,
  onSearch,
}: Readonly<{ query: string; onSearch: (query: string) => void }>) {
  const [search] = useState(
    () => (event: ChangeEvent<HTMLInputElement>) =>
      onSearch(event.target.value),
  );
  return (
    <div className="relative px-1 pb-1">
      <SearchIcon
        aria-hidden
        className="text-muted-foreground absolute start-3.5 top-2 size-4"
      />
      <Input
        type="search"
        aria-label="Search sessions"
        placeholder="Search sessions"
        value={query}
        onChange={search}
        className="ps-8"
      />
    </div>
  );
}

export function MoreSessions({
  matching,
  shown,
  page,
  onMore,
}: Readonly<{
  matching: number;
  shown: number;
  page: number;
  onMore: () => void;
}>) {
  if (matching === 0) {
    return <p className="text-muted-foreground px-3 py-2">No sessions match</p>;
  }
  const hidden = matching - shown;
  if (hidden <= 0) return null;
  return (
    <button
      type="button"
      onClick={onMore}
      className="text-muted-foreground hover:text-foreground w-fit px-3 py-2 text-xs"
    >
      Show {Math.min(hidden, page)} more of {hidden}
    </button>
  );
}
