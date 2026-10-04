import { expect, test } from 'vitest';
import { column, strip } from '@/test/fake-core';
import { locate } from './geometry';
import { resized, withoutPane } from './preview';

const three = (activeColumn: number) =>
  strip('w', [column('a', ['p']), column('b', ['q']), column('c', ['r'])], {
    activeColumn,
  });

function without(layout: ReturnType<typeof three>, paneId: string) {
  return withoutPane(layout, locate(layout, paneId) ?? { column: 9, tile: 9 });
}

test('finds where a pane sits', () => {
  const layout = strip('w', [column('a', ['p']), column('b', ['q', 'r'])]);
  expect(locate(layout, 'r')).toEqual({ column: 1, tile: 1 });
  expect(locate(layout, 'p')).toEqual({ column: 0, tile: 0 });
  expect(locate(layout, 'x')).toBeNull();
});

test('drops the column of a pane that was alone in it', () => {
  expect(without(three(2), 'p')).toEqual(
    strip('w', [column('b', ['q']), column('c', ['r'])], { activeColumn: 1 }),
  );
  expect(without(three(1), 'q').activeColumn).toBe(1);
  expect(without(three(2), 'r').activeColumn).toBe(1);
  expect(without(three(0), 'r').activeColumn).toBe(0);
  const four = strip(
    'w',
    ['a', 'b', 'c', 'd'].map((id) => column(id, [`${id}-pane`])),
    { activeColumn: 2 },
  );
  expect(withoutPane(four, { column: 0, tile: 0 }).activeColumn).toBe(1);
  const lone = strip('w', [column('a', ['p'])]);
  expect(withoutPane(lone, { column: 0, tile: 0 })).toEqual(strip('w', []));
});

function shared(activeTile: number) {
  return strip(
    'w',
    [column('a', ['p']), column('b', ['q', 'r', 's'], { activeTile })],
    { activeColumn: 1 },
  );
}

test('keeps the column of a pane that shared it', () => {
  const after = (activeTile: number, tile: number) =>
    withoutPane(shared(activeTile), { column: 1, tile }).columns[1];
  expect(after(1, 0)).toEqual(column('b', ['r', 's'], { activeTile: 0 }));
  expect(after(1, 1).activeTile).toBe(1);
  expect(after(2, 2).activeTile).toBe(1);
  expect(after(0, 2).activeTile).toBe(0);
  expect(withoutPane(shared(1), { column: 1, tile: 0 }).activeColumn).toBe(1);
  const later = strip('w', [column('a', ['p', 'q']), column('b', ['r'])], {
    activeColumn: 1,
  });
  expect(withoutPane(later, { column: 0, tile: 0 }).activeColumn).toBe(1);
});

test('sets a new width and leaves full width', () => {
  const layout = strip('w', [column('a', ['p'], { fullWidth: true })]);
  expect(
    resized(layout, { column: 0, tile: 0 }, { width: 0.3 }, [700]).columns[0],
  ).toEqual(column('a', ['p'], { width: 0.3 }));
  expect(resized(layout, { column: 0, tile: 0 }, {}, [700])).toEqual(layout);
});

test('fixes the height of one pane and weighs the others by their heights', () => {
  const layout = strip('w', [column('a', ['p', 'q', 'r'])]);
  const heights = resized(
    layout,
    { column: 0, tile: 0 },
    { height: 0.4 },
    [100, 300, 200],
  ).columns[0].tiles.map(({ height }) => height);
  expect(heights).toEqual([{ fixed: 0.4 }, { auto: 1.5 }, { auto: 1 }]);
  const two = strip('w', [column('a', ['p', 'q'])]);
  expect(
    resized(two, { column: 0, tile: 1 }, { height: 0.2 }, [100, 300]).columns[0]
      .tiles,
  ).toEqual([
    { paneId: 'p', height: { auto: 1 / 3 } },
    { paneId: 'q', height: { fixed: 0.2 } },
  ]);
});

test('keeps the other weights when the pane already has a fixed height', () => {
  const layout = strip('w', [
    {
      ...column('a', ['p', 'q']),
      tiles: [
        { paneId: 'p', height: { fixed: 0.3 } },
        { paneId: 'q', height: { auto: 2 } },
      ],
    },
  ]);
  expect(
    resized(layout, { column: 0, tile: 0 }, { height: 0.5 }, [10, 20])
      .columns[0].tiles,
  ).toEqual([
    { paneId: 'p', height: { fixed: 0.5 } },
    { paneId: 'q', height: { auto: 2 } },
  ]);
});
