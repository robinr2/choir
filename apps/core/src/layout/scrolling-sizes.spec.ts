import {
  adjustColumnWidth,
  adjustWindowHeight,
  expandColumnToAvailableWidth,
  maximizeColumn,
  resetActiveWindowHeight,
} from './scrolling-sizes.js';
import { space } from '../test/sketch.js';
import type { Space } from './layout.schemas.js';

function widths(text: string, values: number[], fullWidth = false): Space {
  const strip = space(text);
  strip.columns = strip.columns.map((column, index) => ({
    ...column,
    width: values[index],
    fullWidth: fullWidth && column === strip.columns[strip.activeColumn],
  }));
  return strip;
}

function shown({ columns }: Space): (number | 'full')[] {
  return columns.map(({ width, fullWidth }) => (fullWidth ? 'full' : width));
}

function ids(strip: Space, ...indices: number[]): string[] {
  return indices.map((index) => strip.columns[index].id);
}

it('changes the width of the focused column only', () => {
  expect(shown(adjustColumnWidth(space('A | B*'), 20))).toEqual([0.5, 0.7]);
  expect(shown(adjustColumnWidth(space(''), 20))).toEqual([]);
});

it('maximizes the focused column to full width and back', () => {
  const full = maximizeColumn(space('A | B*'));
  expect(shown(full)).toEqual([0.5, 'full']);
  expect(shown(maximizeColumn(full))).toEqual([0.5, 0.5]);
});

it('changes and resets the height of the focused pane', () => {
  const taller = adjustWindowHeight(space('A | B C*'), 10);
  expect(taller.columns[1].tiles[1].height).toEqual({ fixed: 0.6 });
  const reset = resetActiveWindowHeight(taller);
  expect(reset.columns[1].tiles[1].height).toEqual({ auto: 1 });
});

describe('expand column to available width', () => {
  it('fills the width the other fully visible columns leave', () => {
    const strip = widths('A | B* | C', [0.25, 0.25, 0.25]);
    const expanded = expandColumnToAvailableWidth(strip, ids(strip, 0, 1));
    expect(shown(expanded)).toEqual([0.25, 0.75, 0.25]);
  });

  it('counts a full-width column as the whole width', () => {
    const full = widths('A* | B', [0.25, 0.25], true);
    const strip = { ...full, activeColumn: 1 };
    expect(expandColumnToAvailableWidth(strip, ids(strip, 0, 1))).toBe(strip);
  });

  it('switches to full width when only the focused column is visible', () => {
    const strip = widths('A | B*', [0.5, 0.75]);
    const expanded = expandColumnToAvailableWidth(strip, ids(strip, 1));
    expect(shown(expanded)).toEqual([0.5, 'full']);
  });

  it('does nothing without room or when the focused column is not fully visible', () => {
    const tight = widths('A | B*', [0.5, 0.5]);
    expect(expandColumnToAvailableWidth(tight, ids(tight, 0, 1))).toBe(tight);
    const wide = widths('A*', [1]);
    expect(expandColumnToAvailableWidth(wide, ids(wide, 0))).toBe(wide);
    const hidden = widths('A | B*', [0.25, 0.25]);
    expect(expandColumnToAvailableWidth(hidden, ids(hidden, 0))).toBe(hidden);
    const full = widths('A*', [0.25], true);
    expect(expandColumnToAvailableWidth(full, ids(full, 0))).toBe(full);
    const empty = space('');
    expect(expandColumnToAvailableWidth(empty, [])).toBe(empty);
  });
});
