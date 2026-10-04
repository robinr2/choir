import {
  convertHeightsToAuto,
  effectiveHeights,
  resetWindowHeight,
  setWindowHeight,
} from './column-heights.js';
import type { Column, Height } from './layout.schemas.js';

function column(heights: Height[], active = 0): Column {
  return {
    id: 'c',
    width: 0.5,
    fullWidth: false,
    activeTile: active,
    tiles: heights.map((height, index) => ({ paneId: `P${index}`, height })),
  };
}

function heightsOf({ tiles }: Column): Height[] {
  return tiles.map(({ height }) => height);
}

describe('effectiveHeights', () => {
  it('shares the height by weight', () => {
    expect(effectiveHeights(column([{ auto: 1 }]))).toEqual([1]);
    expect(effectiveHeights(column([{ auto: 1 }, { auto: 3 }]))).toEqual([
      0.25, 0.75,
    ]);
  });

  it('gives the fixed pane its height and the auto panes the rest', () => {
    expect(
      effectiveHeights(column([{ auto: 1 }, { fixed: 0.25 }, { auto: 2 }])),
    ).toEqual([0.25, 0.25, 0.5]);
  });

  it('lets a pane alone in its column be shorter than the column', () => {
    expect(effectiveHeights(column([{ fixed: 0.3 }]))).toEqual([0.3]);
  });

  it('keeps fixed heights between 0 and the whole column', () => {
    expect(effectiveHeights(column([{ fixed: 1.5 }, { auto: 1 }]))).toEqual([
      1, 0,
    ]);
    expect(effectiveHeights(column([{ fixed: -1 }, { auto: 1 }]))).toEqual([
      0, 1,
    ]);
  });
});

describe('convertHeightsToAuto', () => {
  it('keeps the shown heights, weighted against the median height', () => {
    const converted = convertHeightsToAuto(
      column([{ auto: 1 }, { fixed: 0.5 }, { auto: 1 }]),
    );
    expect(heightsOf(converted)).toEqual([
      { auto: 1 },
      { auto: 2 },
      { auto: 1 },
    ]);
  });

  it('takes the upper median for an even number of panes', () => {
    const converted = convertHeightsToAuto(column([{ auto: 1 }, { auto: 3 }]));
    expect(heightsOf(converted)).toEqual([{ auto: 1 / 3 }, { auto: 1 }]);
  });

  it('gives squeezed panes a small weight instead of none', () => {
    const converted = convertHeightsToAuto(
      column([{ fixed: 1 }, { auto: 1 }, { auto: 1 }]),
    );
    expect(heightsOf(converted)).toEqual([
      { auto: 100 },
      { auto: 1 },
      { auto: 1 },
    ]);
  });
});

describe('setWindowHeight', () => {
  it('fixes the active pane height by percent points and makes the others auto', () => {
    const changed = setWindowHeight(
      column([{ auto: 1 }, { auto: 1 }, { auto: 2 }], 1),
      { adjust: 10 },
    );
    expect(heightsOf(changed)).toEqual([
      { auto: 1 },
      { fixed: 0.35 },
      { auto: 2 },
    ]);
  });

  it('changes a fixed height without touching the auto weights', () => {
    const changed = setWindowHeight(column([{ fixed: 0.5 }, { auto: 3 }], 0), {
      adjust: -20,
    });
    expect(heightsOf(changed)).toEqual([{ fixed: 0.3 }, { auto: 3 }]);
  });

  it('turns another fixed pane into auto when a pane gets a height', () => {
    const changed = setWindowHeight(
      column([{ fixed: 0.25 }, { auto: 1 }]),
      { set: 0.5 },
      1,
    );
    expect(heightsOf(changed)).toEqual([{ auto: 1 / 3 }, { fixed: 0.5 }]);
  });

  it('keeps the height between nothing and the whole column', () => {
    const alone = column([{ auto: 1 }]);
    expect(heightsOf(setWindowHeight(alone, { adjust: 10 }))).toEqual([
      { fixed: 1 },
    ]);
    expect(heightsOf(setWindowHeight(alone, { set: -0.5 }))).toEqual([
      { fixed: 0 },
    ]);
  });
});

it('resets the active pane to an automatic height', () => {
  const reset = resetWindowHeight(column([{ auto: 2 }, { fixed: 0.3 }], 1));
  expect(heightsOf(reset)).toEqual([{ auto: 2 }, { auto: 1 }]);
});
