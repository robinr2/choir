import {
  consumeOrExpelWindowLeft,
  consumeOrExpelWindowRight,
  consumeWindowIntoColumn,
  expelWindowFromColumn,
} from './scrolling-consume.js';
import { after, sketch, space } from '../test/sketch.js';
import type { Space } from './layout.schemas.js';

function sized(text: string, column: number, width: number): Space {
  const strip = space(text);
  strip.columns[column] = { ...strip.columns[column], width, fullWidth: true };
  return strip;
}

describe('consume or expel left', () => {
  it('puts a pane alone in its column at the bottom of the column on the left', () => {
    expect(after(consumeOrExpelWindowLeft, 'A B | C*')).toBe('A B C*');
    expect(after(consumeOrExpelWindowLeft, 'A | B* | C')).toBe('A B* | C');
  });

  it('gives the pane the width of the column it joins', () => {
    const joined = consumeOrExpelWindowLeft(sized('A | B*', 0, 0.3));
    expect(joined.columns[0]).toMatchObject({ width: 0.3, fullWidth: true });
  });

  it('forgets the column to go back to', () => {
    const joined = consumeOrExpelWindowLeft(space('A | B*', true));
    expect([sketch(joined), joined.restoresPrevious]).toEqual(['A B*', false]);
  });

  it('turns a pane that shares its column into its own column on the left', () => {
    const expelled = consumeOrExpelWindowLeft(space('A | B C*', true));
    expect([sketch(expelled), expelled.restoresPrevious]).toEqual([
      'A | C* | B',
      false,
    ]);
  });

  it('keeps the size of the column the pane leaves', () => {
    const expelled = consumeOrExpelWindowLeft(sized('B* C', 0, 0.7));
    expect(expelled.columns[0]).toMatchObject({ width: 0.7, fullWidth: true });
  });

  it('does nothing in the first column or an empty workspace', () => {
    expect(after(consumeOrExpelWindowLeft, 'A* | B')).toBe('A* | B');
    expect(after(consumeOrExpelWindowLeft, '')).toBe('');
  });
});

describe('consume or expel right', () => {
  it('puts a pane alone in its column at the bottom of the column on the right', () => {
    expect(after(consumeOrExpelWindowRight, 'A* | B C')).toBe('B C A*');
    expect(after(consumeOrExpelWindowRight, 'X | A* | B')).toBe('X | B A*');
  });

  it('gives the pane the width of the column it joins and forgets the way back', () => {
    const strip = { ...sized('X | A* | B', 2, 0.3), restoresPrevious: true };
    const joined = consumeOrExpelWindowRight(strip);
    expect(joined.columns[1]).toMatchObject({ width: 0.3, fullWidth: true });
    expect(joined.restoresPrevious).toBe(false);
  });

  it('turns a pane that shares its column into its own column on the right', () => {
    const expelled = consumeOrExpelWindowRight(sized('A* B | C', 0, 0.7));
    expect(sketch(expelled)).toBe('B | A* | C');
    expect(expelled.columns[1]).toMatchObject({ width: 0.7, fullWidth: true });
    expect(expelled.restoresPrevious).toBe(true);
  });

  it('does nothing in the last column or an empty workspace', () => {
    expect(after(consumeOrExpelWindowRight, 'A | B*')).toBe('A | B*');
    expect(after(consumeOrExpelWindowRight, '')).toBe('');
  });
});

describe('consume into column', () => {
  it('takes the top pane of the column on the right and keeps the focus', () => {
    expect(after(consumeWindowIntoColumn, 'A* | B')).toBe('A* B');
    expect(after(consumeWindowIntoColumn, 'A* | B C | D')).toBe('A* B | C | D');
  });

  it('remembers the column to go back to', () => {
    const joined = consumeWindowIntoColumn(space('A | B* | C', true));
    expect([sketch(joined), joined.restoresPrevious]).toEqual([
      'A | B* C',
      true,
    ]);
  });

  it('does nothing without a column on the right', () => {
    expect(after(consumeWindowIntoColumn, 'A | B*')).toBe('A | B*');
    expect(after(consumeWindowIntoColumn, 'A*')).toBe('A*');
    expect(after(consumeWindowIntoColumn, '')).toBe('');
  });
});

describe('expel from column', () => {
  it('turns the bottom pane into a column on the right and keeps the focus', () => {
    expect(after(expelWindowFromColumn, 'A* B C | D')).toBe('A* B | C | D');
  });

  it('focuses the pane above when the focused bottom pane leaves', () => {
    expect(after(expelWindowFromColumn, 'A B*')).toBe('A* | B');
  });

  it('keeps the size of the column for the new one and the way back', () => {
    const strip = { ...sized('X | A* B', 1, 0.7), restoresPrevious: true };
    const expelled = expelWindowFromColumn(strip);
    expect(expelled.columns[2]).toMatchObject({ width: 0.7, fullWidth: true });
    expect(expelled.restoresPrevious).toBe(true);
  });

  it('does nothing with a pane alone or an empty workspace', () => {
    expect(after(expelWindowFromColumn, 'A* | B')).toBe('A* | B');
    expect(after(expelWindowFromColumn, '')).toBe('');
  });
});
