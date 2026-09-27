import {
  addAtEdge,
  type LayoutNode,
  leaves,
  normalizedLayout,
  removeLeaf,
  sameLeaves,
  splitLeaf,
  swapLeaves,
} from './layout-tree.js';

function row(children: LayoutNode[], splitPercentages: number[]): LayoutNode {
  return { type: 'split', direction: 'row', children, splitPercentages };
}

function column(
  children: LayoutNode[],
  splitPercentages: number[],
): LayoutNode {
  return { type: 'split', direction: 'column', children, splitPercentages };
}

describe('splitLeaf', () => {
  it('halves a pane and puts the new agent to the right or below', () => {
    expect(splitLeaf('a', 'a', 'b', 'row')).toEqual(row(['a', 'b'], [50, 50]));
    expect(splitLeaf('a', 'a', 'b', 'column')).toEqual(
      column(['a', 'b'], [50, 50]),
    );
  });

  it('keeps the split flat when it runs the same way as its parent', () => {
    expect(splitLeaf(row(['a', 'b'], [60, 40]), 'b', 'c', 'row')).toEqual(
      row(['a', 'b', 'c'], [60, 20, 20]),
    );
  });

  it('nests a split that runs the other way', () => {
    expect(splitLeaf(row(['a', 'b'], [60, 40]), 'a', 'c', 'column')).toEqual(
      row([column(['a', 'c'], [50, 50]), 'b'], [60, 40]),
    );
  });

  it('places the agent alone in an empty layout', () => {
    expect(splitLeaf(null, 'a', 'b', 'row')).toBe('b');
  });
});

describe('addAtEdge', () => {
  it('gives the first agent the whole area', () => {
    expect(addAtEdge(null, 'a', 'left')).toBe('a');
  });

  it('adds a column on the left or right and a row on the top or bottom', () => {
    expect(addAtEdge('a', 'b', 'left')).toEqual(row(['b', 'a'], [50, 50]));
    expect(addAtEdge('a', 'b', 'right')).toEqual(row(['a', 'b'], [50, 50]));
    expect(addAtEdge('a', 'b', 'top')).toEqual(column(['b', 'a'], [50, 50]));
    expect(addAtEdge('a', 'b', 'bottom')).toEqual(column(['a', 'b'], [50, 50]));
  });

  it('gives the new column an even share and shrinks the others proportionally', () => {
    expect(addAtEdge(row(['a', 'b'], [80, 20]), 'c', 'right')).toEqual(
      row(['a', 'b', 'c'], [(80 * 2) / 3, (20 * 2) / 3, 100 / 3]),
    );
    expect(addAtEdge(row(['a', 'b', 'c'], [40, 40, 20]), 'd', 'left')).toEqual(
      row(['d', 'a', 'b', 'c'], [25, 30, 30, 15]),
    );
  });

  it('adds a row across columns', () => {
    expect(addAtEdge(row(['a', 'b'], [70, 30]), 'c', 'bottom')).toEqual(
      column([row(['a', 'b'], [70, 30]), 'c'], [50, 50]),
    );
  });
});

describe('removeLeaf', () => {
  it('gives a closed pane its whole space to its only neighbour', () => {
    expect(removeLeaf(row(['a', 'b'], [70, 30]), 'a')).toBe('b');
    expect(
      removeLeaf(row([column(['a', 'b'], [50, 50]), 'c'], [60, 40]), 'b'),
    ).toEqual(row(['a', 'c'], [60, 40]));
  });

  it('shares the space out evenly between three or more panes, as React Mosaic does', () => {
    expect(removeLeaf(row(['a', 'b', 'c'], [20, 30, 50]), 'a')).toEqual(
      row(['b', 'c'], [40, 60]),
    );
  });

  it('merges splits that end up running the same way', () => {
    const nested = row(
      ['a', column([row(['b', 'c'], [50, 50]), 'd'], [50, 50])],
      [50, 50],
    );
    expect(removeLeaf(nested, 'd')).toEqual(row(['a', 'b', 'c'], [50, 25, 25]));
  });

  it('empties the layout when the last pane closes', () => {
    expect(removeLeaf('a', 'a')).toBeNull();
    expect(removeLeaf(null, 'a')).toBeNull();
  });

  it('keeps a layout without the pane', () => {
    expect(removeLeaf('a', 'b')).toBe('a');
  });
});

describe('swapLeaves', () => {
  it('swaps two panes and leaves the others', () => {
    expect(
      swapLeaves(row(['a', column(['b', 'c'], [50, 50])], [30, 70]), 'a', 'c'),
    ).toEqual(row(['c', column(['b', 'a'], [50, 50])], [30, 70]));
    expect(swapLeaves(null, 'a', 'b')).toBeNull();
  });
});

describe('leaves', () => {
  it('lists the panes in reading order', () => {
    expect(leaves(row(['a', column(['b', 'c'], [50, 50])], [50, 50]))).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(leaves(null)).toEqual([]);
  });
});

describe('sameLeaves', () => {
  it('compares the panes regardless of where they are', () => {
    expect(
      sameLeaves(row(['a', 'b'], [50, 50]), row(['b', 'a'], [10, 90])),
    ).toBe(true);
    expect(sameLeaves(row(['a', 'b'], [50, 50]), 'a')).toBe(false);
    expect(sameLeaves('a', row(['a', 'b'], [50, 50]))).toBe(false);
    expect(
      sameLeaves(row(['a', 'b'], [50, 50]), row(['a', 'c'], [50, 50])),
    ).toBe(false);
    expect(sameLeaves(null, null)).toBe(true);
  });
});

describe('normalizedLayout', () => {
  it('flattens nested splits that run the same way', () => {
    expect(
      normalizedLayout(row([row(['a', 'b'], [50, 50]), 'c'], [40, 60])),
    ).toEqual(row(['a', 'b', 'c'], [20, 20, 60]));
    expect(normalizedLayout(null)).toBeNull();
  });
});
