import { Suspense, use, useCallback, useState } from 'react';
import {
  FileTree,
  FileTreeFolder,
  FileTreeNote,
} from '@/components/assistant-ui/elements/file-tree';
import { useAgents } from './agents-context';
import type { FolderListing } from './core-agents';
import { pathsTo, ROOT } from './folder-paths';

type Folder = { name: string; path: string };

type Tree = {
  selected: string;
  expanded: ReadonlySet<string>;
  listings: ReadonlyMap<string, Promise<FolderListing>>;
  toggle: (path: string) => void;
  select: (path: string) => void;
};

const ROOT_FOLDER: Folder = { name: ROOT, path: ROOT };

const LOADING = <FileTreeNote>Loading…</FileTreeNote>;

function revealSelected(row: HTMLDivElement | null): void {
  row?.scrollIntoView({ block: 'nearest' });
}

function useTree(selected: string, select: (path: string) => void): Tree {
  const agents = useAgents();
  const [state, setState] = useState(() => {
    const open = pathsTo(selected);
    return {
      expanded: new Set(open),
      listings: new Map(open.map((path) => [path, agents.folders(path)])),
    };
  });
  const toggle = useCallback(
    (path: string) => {
      const expanded = new Set(state.expanded);
      if (!expanded.delete(path)) expanded.add(path);
      const listings = new Map(state.listings);
      listings.set(path, listings.get(path) ?? agents.folders(path));
      setState({ expanded, listings });
    },
    [agents, state],
  );
  return { ...state, selected, toggle, select };
}

function Subfolders({
  listing,
  depth,
  tree,
}: Readonly<{ listing: Promise<FolderListing>; depth: number; tree: Tree }>) {
  const { folders } = use(listing);
  if (folders.length === 0) return <FileTreeNote>No folders</FileTreeNote>;
  return folders.map((folder) => (
    <FolderBranch key={folder.path} folder={folder} depth={depth} tree={tree} />
  ));
}

function FolderBranch({
  folder: { name, path },
  depth,
  tree,
}: Readonly<{ folder: Folder; depth: number; tree: Tree }>) {
  const selected = tree.selected === path;
  const listing = tree.listings.get(path);
  return (
    <FileTreeFolder
      name={name}
      path={path}
      depth={depth}
      expanded={tree.expanded.has(path)}
      selected={selected}
      onToggle={tree.toggle}
      onSelect={tree.select}
      ref={selected ? revealSelected : undefined}
    >
      {listing && (
        <Suspense fallback={LOADING}>
          <Subfolders listing={listing} depth={depth + 1} tree={tree} />
        </Suspense>
      )}
    </FileTreeFolder>
  );
}

export function FolderTree({
  selected,
  onSelect,
}: Readonly<{ selected: string; onSelect: (path: string) => void }>) {
  const tree = useTree(selected, onSelect);
  return (
    <FileTree aria-label="Folder" className="h-64">
      <FolderBranch folder={ROOT_FOLDER} depth={0} tree={tree} />
    </FileTree>
  );
}
