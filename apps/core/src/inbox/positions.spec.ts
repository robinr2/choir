import { NotFoundException } from '@nestjs/common';
import { between, move, type RankQueries, rankedTable } from './positions.js';

describe('between', () => {
  it('goes one past the only neighbour at either end', () => {
    expect(between(undefined, 5)).toBe(4);
    expect(between(5, undefined)).toBe(6);
    expect(between(undefined, undefined)).toBe(0);
  });

  it('takes the middle while there is room', () => {
    expect(between(1, 2)).toBe(1.5);
    expect(between(1, 1 + Number.EPSILON)).toBeUndefined();
    expect(between(2, 1)).toBeUndefined();
  });
});

function table(positions: Record<string, number>) {
  const queries: RankQueries = {
    find: async (id) => (id in positions ? { position: positions[id] } : null),
    neighbour: async (position, side) => {
      const others = Object.values(positions).filter((other) =>
        side === 'after' ? other > position : other < position,
      );
      if (others.length === 0) return null;
      return {
        position: side === 'after' ? Math.min(...others) : Math.max(...others),
      };
    },
    place: async (id, position) => {
      positions[id] = position;
    },
    ordered: async () =>
      Object.entries(positions)
        .toSorted(([, first], [, second]) => first - second)
        .map(([id]) => ({ id })),
  };
  return rankedTable(queries, 'entry');
}

it('moves an entry right before or after another', async () => {
  const positions = { a: 1, b: 2, c: 3 };
  await move(table(positions), 'c', { after: 'a' });
  expect(positions).toEqual({ a: 1, b: 2, c: 1.5 });
  await move(table(positions), 'a', { before: 'c' });
  expect(positions).toEqual({ a: 1.25, b: 2, c: 1.5 });
  await move(table(positions), 'b', { before: 'a' });
  expect(positions).toEqual({ a: 1.25, b: 0.25, c: 1.5 });
  await move(table(positions), 'b', { after: 'c' });
  expect(positions).toEqual({ a: 1.25, b: 2.5, c: 1.5 });
});

it('numbers the entries anew when there is no room left between two', async () => {
  const positions = { a: 1, b: 1 + Number.EPSILON, c: 3 };
  await move(table(positions), 'c', { after: 'a' });
  expect(positions).toEqual({ a: 1, b: 2, c: 1.5 });
});

it('refuses to move entries that do not exist', async () => {
  const positions = { a: 1 };
  await expect(move(table(positions), 'x', { after: 'a' })).rejects.toThrow(
    new NotFoundException('There is no entry x'),
  );
  await expect(move(table(positions), 'a', { before: 'x' })).rejects.toThrow(
    new NotFoundException('There is no entry x'),
  );
});

it('finds no room when the middle rounds onto the upper neighbour', () => {
  expect(between(1 - Number.EPSILON / 2, 1)).toBeUndefined();
});
