export type SplitDirection = 'row' | 'column';

type LayoutSplit = {
  type: 'split';
  direction: SplitDirection;
  children: LayoutNode[];
  splitPercentages: number[];
};

export type LayoutNode = string | LayoutSplit;

export type Edge = 'left' | 'right' | 'top' | 'bottom';

const FULL = 100;

function split(
  direction: SplitDirection,
  children: LayoutNode[],
  splitPercentages: number[],
): LayoutSplit {
  return { type: 'split', direction, children, splitPercentages };
}

function flattened(node: LayoutSplit): [LayoutNode[], number[]] {
  const children: LayoutNode[] = [];
  const percentages: number[] = [];
  node.children.forEach((child, index) => {
    const share = node.splitPercentages[index];
    const inner = normalized(child);
    if (typeof inner === 'string' || inner.direction !== node.direction) {
      children.push(inner);
      percentages.push(share);
      return;
    }
    children.push(...inner.children);
    percentages.push(...inner.splitPercentages.map((p) => (p * share) / FULL));
  });
  return [children, percentages];
}

function normalized(node: LayoutNode): LayoutNode {
  if (typeof node === 'string') return node;
  const [children, percentages] = flattened(node);
  if (children.length === 1) return children[0];
  return split(node.direction, children, percentages);
}

export function leaves(node: LayoutNode | null): string[] {
  if (node === null) return [];
  if (typeof node === 'string') return [node];
  return node.children.flatMap(leaves);
}

function mapLeaves(
  node: LayoutNode,
  replace: (leaf: string) => LayoutNode,
): LayoutNode {
  if (typeof node === 'string') return replace(node);
  return {
    ...node,
    children: node.children.map((child) => mapLeaves(child, replace)),
  };
}

export function splitLeaf(
  node: LayoutNode | null,
  id: string,
  added: string,
  direction: SplitDirection,
): LayoutNode {
  if (node === null) return added;
  return normalized(
    mapLeaves(node, (leaf) =>
      leaf === id ? split(direction, [id, added], [50, 50]) : leaf,
    ),
  );
}

const EDGES: Record<Edge, { direction: SplitDirection; first: boolean }> = {
  left: { direction: 'row', first: true },
  right: { direction: 'row', first: false },
  top: { direction: 'column', first: true },
  bottom: { direction: 'column', first: false },
};

function asSplit(node: LayoutNode, direction: SplitDirection): LayoutSplit {
  if (typeof node !== 'string' && node.direction === direction) return node;
  return split(direction, [node], [FULL]);
}

export function addAtEdge(
  node: LayoutNode | null,
  added: string,
  edge: Edge,
): LayoutNode {
  if (node === null) return added;
  const { direction, first } = EDGES[edge];
  const { children, splitPercentages } = asSplit(node, direction);
  const count = children.length;
  const shrunk = splitPercentages.map((p) => (p * count) / (count + 1));
  const share = FULL / (count + 1);
  return first
    ? split(direction, [added, ...children], [share, ...shrunk])
    : split(direction, [...children, added], [...shrunk, share]);
}

type Share = { node: LayoutNode | null; share: number };

type KeptShare = { node: LayoutNode; share: number };

function isKept(entry: Share): entry is KeptShare {
  return entry.node !== null;
}

function total(entries: Share[]): number {
  return entries.reduce((sum, { share }) => sum + share, 0);
}

function nodeOf({ node }: KeptShare): LayoutNode {
  return node;
}

function keptLeaf(leaf: string, id: string): string | null {
  return leaf === id ? null : leaf;
}

function shares(node: LayoutSplit, id: string): Share[] {
  return node.children.map((child, index) => ({
    node: without(child, id),
    share: node.splitPercentages[index],
  }));
}

function without(node: LayoutNode, id: string): LayoutNode | null {
  if (typeof node === 'string') return keptLeaf(node, id);
  const all = shares(node, id);
  const kept = all.filter(isKept);
  const bonus = (total(all) - total(kept)) / kept.length;
  return split(
    node.direction,
    kept.map(nodeOf),
    kept.map(({ share }) => share + bonus),
  );
}

export function removeLeaf(
  node: LayoutNode | null,
  id: string,
): LayoutNode | null {
  const rest = node && without(node, id);
  return rest === null ? null : normalized(rest);
}

export function swapLeaves(
  node: LayoutNode | null,
  first: string,
  second: string,
): LayoutNode | null {
  if (node === null) return null;
  return mapLeaves(node, (leaf) => {
    if (leaf === first) return second;
    return leaf === second ? first : leaf;
  });
}

export function sameLeaves(
  node: LayoutNode | null,
  other: LayoutNode | null,
): boolean {
  const mine = leaves(node).toSorted();
  const theirs = leaves(other).toSorted();
  return (
    mine.length === theirs.length &&
    mine.every((leaf, index) => leaf === theirs[index])
  );
}

export function normalizedLayout(node: LayoutNode | null): LayoutNode | null {
  return node === null ? null : normalized(node);
}
