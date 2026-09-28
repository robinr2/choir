import { NotFoundException } from '@nestjs/common';
import type { Placement } from './listing.js';

export type RankedTable = {
  position(id: string): Promise<number>;
  neighbour(
    position: number,
    side: 'before' | 'after',
  ): Promise<number | undefined>;
  place(id: string, position: number): Promise<void>;
  renumber(): Promise<void>;
};

export type RankQueries = {
  find(id: string): Promise<{ position: number } | null>;
  neighbour(
    position: number,
    side: 'before' | 'after',
  ): Promise<{ position: number } | null>;
  place(id: string, position: number): Promise<unknown>;
  ordered(): PromiseLike<{ id: string }[]>;
};

function edge(low?: number, high?: number): number {
  return low === undefined ? (high ?? 1) - 1 : low + 1;
}

export function between(low?: number, high?: number): number | undefined {
  if (low === undefined || high === undefined) return edge(low, high);
  const middle = (low + high) / 2;
  return low < middle && middle < high ? middle : undefined;
}

export function rankedTable(queries: RankQueries, noun: string): RankedTable {
  return {
    position: async (id) => {
      const row = await queries.find(id);
      if (!row) throw new NotFoundException(`There is no ${noun} ${id}`);
      return row.position;
    },
    neighbour: async (position, side) =>
      (await queries.neighbour(position, side))?.position,
    place: async (id, position) => {
      await queries.place(id, position);
    },
    renumber: async () => {
      const rows = await queries.ordered();
      await Promise.all(
        rows.map(({ id }, index) => queries.place(id, index + 1)),
      );
    },
  };
}

async function bounds(
  table: RankedTable,
  placement: Placement,
): Promise<[number | undefined, number | undefined]> {
  if ('after' in placement) {
    const low = await table.position(placement.after);
    return [low, await table.neighbour(low, 'after')];
  }
  const high = await table.position(placement.before);
  return [await table.neighbour(high, 'before'), high];
}

export async function move(
  table: RankedTable,
  id: string,
  placement: Placement,
): Promise<void> {
  await table.position(id);
  const position = between(...(await bounds(table, placement)));
  if (position !== undefined) return table.place(id, position);
  await table.renumber();
  return move(table, id, placement);
}
