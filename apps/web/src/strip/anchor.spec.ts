import { expect, test } from 'vitest';
import { column, strip } from '@/test/fake-core';
import { anchored } from './anchor';

const metrics = { width: 1000, height: 800, gap: 4 };

const columns = [
  column('a', ['p'], { width: 0.3 }),
  column('b', ['q'], { width: 0.4 }),
];

function strips(activeColumn: number) {
  const layout = strip('w', columns, { activeColumn });
  return new Map([['w', { layout, offset: 0, saved: 7 }]]);
}

test('puts the anchored column at the left edge once the width changed', () => {
  const moved = anchored(
    { workspaceId: 'w', columnId: 'a', width: 0.3 },
    strips(1),
    metrics,
  );
  expect(moved?.get('w')).toEqual({
    layout: strip('w', columns, { activeColumn: 1 }),
    offset: -302.8,
    saved: 7,
  });
  const second = anchored(
    { workspaceId: 'w', columnId: 'b', width: 0.3 },
    strips(1),
    metrics,
  );
  expect(second?.get('w')?.offset).toBe(-4);
});

test('waits while the width is unchanged or the column is gone', () => {
  const anchor = { workspaceId: 'w', columnId: 'a', width: 0.4 };
  expect(anchored(anchor, strips(1), metrics)).toBeNull();
  expect(
    anchored({ ...anchor, columnId: 'x', width: 0.3 }, strips(1), metrics),
  ).toBeNull();
  expect(anchored({ ...anchor, workspaceId: 'v' }, strips(1), metrics)).toBe(
    null,
  );
});
