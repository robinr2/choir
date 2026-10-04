import { layoutActionSchema } from './layout.schemas.js';

const PANE = '0b6f2c9e-3f5d-4a8e-9c1b-2d7e6f5a4b3c';

function resizes(size: { width?: number; height?: number }): boolean {
  return layoutActionSchema.safeParse({
    action: 'resizePane',
    paneId: PANE,
    ...size,
  }).success;
}

it('accepts a column width from nothing up to ten thousand view widths', () => {
  expect([0, 0.5, 10_000].map((width) => resizes({ width }))).toEqual([
    true,
    true,
    true,
  ]);
  expect([-0.1, 10_000.5].map((width) => resizes({ width }))).toEqual([
    false,
    false,
  ]);
});

it('accepts a pane height from nothing up to the whole column', () => {
  expect([0, 0.5, 1].map((height) => resizes({ height }))).toEqual([
    true,
    true,
    true,
  ]);
  expect([-0.1, 1.5].map((height) => resizes({ height }))).toEqual([
    false,
    false,
  ]);
});
