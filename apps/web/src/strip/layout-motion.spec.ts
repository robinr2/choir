import { expect, test, vi } from 'vitest';
import { type Frame, LayoutMotion } from './layout-motion';
import type { Placement } from './placements';

function placed(
  paneId: string,
  x: number,
  extra: Partial<Placement> = {},
): Placement {
  return {
    paneId,
    workspaceId: 'first',
    rect: { x, y: 4, width: 100, height: 200 },
    focused: false,
    muted: false,
    dragged: false,
    ...extra,
  };
}

function frameOf(placements: Placement[], extra: Partial<Frame> = {}): Frame {
  return {
    placements,
    spaces: [{ id: 'first', index: 0, viewX: -4 }],
    renderIndex: 0,
    step: 880,
    width: 1200,
    height: 800,
    zoom: 1,
    ready: true,
    tracking: 'none',
    ...extra,
  };
}

function ready(placements: Placement[]): LayoutMotion {
  const motion = new LayoutMotion();
  placements.forEach((placement) => motion.tile(placement));
  motion.apply(frameOf(placements));
  return motion;
}

test('jumps to the first layout it sees', () => {
  const motion = new LayoutMotion();
  const tile = motion.tile(placed('a', 0));
  motion.apply(frameOf([placed('a', 50)], { renderIndex: 2 }));
  expect(tile.x.get()).toBe(50);
  expect(tile.opacity.get()).toBe(1);
  expect(tile.x.isAnimating()).toBe(false);
  expect(motion.renderIndex.get()).toBe(2);
  expect(motion.step.get()).toBe(880);
  expect(motion.space('first').viewX.get()).toBe(-4);
});

test('keeps jumping until the view is ready', () => {
  const motion = new LayoutMotion();
  motion.apply(frameOf([placed('a', 0)], { ready: false }));
  const tile = motion.tile(placed('a', 0));
  expect(tile.opacity.get()).toBe(1);
  motion.apply(frameOf([placed('a', 30)]));
  expect(tile.x.get()).toBe(30);
});

function nextValue(value: { on: LayoutMotion['step']['on'] }) {
  return new Promise<number>((resolve) => {
    const stop = value.on('change', (latest: number) => {
      stop();
      resolve(latest);
    });
  });
}

test('glides panes to their new place and keeps their speed', async () => {
  const motion = ready([placed('a', 0)]);
  const tile = motion.tile(placed('a', 0));
  const watched = tile.x.on('change', () => {});
  motion.apply(frameOf([placed('a', 400)]));
  expect(tile.x.isAnimating()).toBe(true);
  await vi.waitFor(() => expect(tile.x.get()).toBeGreaterThan(100));
  const here = Math.round(tile.x.get());
  motion.apply(frameOf([placed('a', here)]));
  expect(await nextValue(tile.x)).toBeGreaterThan(here);
  await vi.waitFor(() => expect(tile.x.get()).toBe(here));
  watched();
});

test('leaves a running animation alone when the target stays', () => {
  const motion = ready([placed('a', 0)]);
  const tile = motion.tile(placed('a', 0));
  motion.apply(frameOf([placed('a', 400)]));
  const running = vi.spyOn(tile.x, 'stop');
  motion.apply(frameOf([placed('a', 400)]));
  expect(running).not.toHaveBeenCalled();
});

test('slides the view and the workspaces', async () => {
  const motion = ready([placed('a', 0)]);
  const space = motion.space('first');
  motion.apply(
    frameOf([placed('a', 0)], {
      renderIndex: 1,
      spaces: [{ id: 'first', index: 0, viewX: 300 }],
    }),
  );
  expect(space.viewX.isAnimating()).toBe(true);
  expect(motion.renderIndex.isAnimating()).toBe(true);
  await vi.waitFor(() => expect(motion.renderIndex.get()).toBe(1));
  await vi.waitFor(() => expect(space.viewX.get()).toBe(300));
});

test('places a new workspace without sliding its view', () => {
  const motion = ready([placed('a', 0)]);
  const spaces = [
    { id: 'first', index: 0, viewX: -4 },
    { id: 'second', index: 1, viewX: 250 },
  ];
  motion.apply(frameOf([placed('a', 0)], { spaces }));
  expect(motion.space('second').viewX.get()).toBe(250);
  expect(motion.space('second').index.get()).toBe(1);
});

test('follows gestures directly', () => {
  const motion = ready([placed('a', 0)]);
  const tile = motion.tile(placed('a', 0));
  const space = motion.space('first');
  motion.apply(
    frameOf([placed('a', 80)], {
      tracking: 'all',
      renderIndex: 0.5,
      spaces: [{ id: 'first', index: 0, viewX: 30 }],
    }),
  );
  expect(tile.x.get()).toBe(80);
  expect(space.viewX.get()).toBe(30);
  expect(motion.renderIndex.get()).toBe(0.5);
  expect(tile.x.isAnimating()).toBe(false);
});

test('moves only the dragged pane directly while others make room', () => {
  const motion = ready([placed('a', 0), placed('b', 200)]);
  motion.apply(
    frameOf([placed('a', 90, { dragged: true }), placed('b', 0)], {
      tracking: 'view',
    }),
  );
  expect(motion.tile(placed('a', 0)).x.get()).toBe(90);
  expect(motion.tile(placed('b', 0)).x.isAnimating()).toBe(true);
});

test('jumps a pane that lands on another workspace', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 500, { workspaceId: 'second' })]));
  expect(motion.tile(placed('a', 0)).x.get()).toBe(500);
});

test('jumps everything when the strip changes size', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 70)], { width: 900 }));
  expect(motion.tile(placed('a', 0)).x.get()).toBe(70);
});

test('opens a new pane from half its size', async () => {
  const motion = ready([placed('a', 0)]);
  const tile = motion.tile(placed('b', 200));
  expect([tile.opacity.get(), tile.scale.get()]).toEqual([0, 0.5]);
  motion.apply(frameOf([placed('a', 0), placed('b', 200)]));
  await vi.waitFor(() =>
    expect([tile.opacity.get(), tile.scale.get()]).toEqual([1, 1]),
  );
});

test('closes a pane by fading and shrinking it', async () => {
  const motion = ready([placed('a', 0)]);
  const tile = motion.tile(placed('a', 0));
  await motion.close('a');
  expect([tile.opacity.get(), tile.scale.get()]).toEqual([0, 0.8]);
  expect(motion.tile(placed('a', 0))).not.toBe(tile);
  await expect(motion.close('gone')).resolves.toBeUndefined();
});

test('brings back a pane that returns while it closes', async () => {
  const motion = ready([placed('a', 0)]);
  const tile = motion.tile(placed('a', 0));
  void motion.close('a');
  await vi.waitFor(() => expect(tile.scale.get()).toBeLessThan(0.95));
  motion.apply(frameOf([placed('a', 0)]));
  await vi.waitFor(() =>
    expect([tile.opacity.get(), tile.scale.get()]).toEqual([1, 1]),
  );
  expect(motion.tile(placed('a', 0))).toBe(tile);
});

test('zooms out to the overview and back in', async () => {
  const motion = ready([placed('a', 0)]);
  expect([motion.zoom.get(), motion.width.get(), motion.height.get()]).toEqual([
    1, 1200, 800,
  ]);
  motion.apply(frameOf([placed('a', 0)], { zoom: 0.5 }));
  expect(motion.zoom.isAnimating()).toBe(true);
  expect(motion.renderIndex.isAnimating()).toBe(false);
  await vi.waitFor(() => expect(motion.zoom.get()).toBe(0.5));
  motion.apply(frameOf([placed('a', 0)], { zoom: 1 }));
  await vi.waitFor(() => expect(motion.zoom.get()).toBe(1));
});

test('moves monotonically when the overview closes on another workspace', async () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { zoom: 0.5 }));
  await vi.waitFor(() => expect(motion.zoom.get()).toBe(0.5));
  motion.apply(frameOf([placed('a', 0)], { zoom: 1, renderIndex: 2 }));
  const seen: number[] = [];
  const progress: number[][] = [];
  const stop = motion.zoom.on('change', () => {
    seen.push((2 - motion.shown()) * motion.zoom.get());
    progress.push([
      motion.renderIndex.get() / 2,
      (motion.zoom.get() - 0.5) / 0.5,
    ]);
  });
  await vi.waitFor(() => expect(motion.shown()).toBe(2));
  stop();
  progress.forEach(([index, zoom]) => expect(index).toBeCloseTo(zoom, 2));
  expect(seen.length).toBeGreaterThan(2);
  seen.forEach((distance, index) =>
    expect(distance).toBeLessThanOrEqual((seen[index - 1] ?? 2) + 1e-9),
  );
});

test('continues from the shown place when a switch interrupts the closing', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { zoom: 0.5 }));
  motion.zoom.jump(0.5);
  motion.apply(frameOf([placed('a', 0)], { zoom: 1, renderIndex: 2 }));
  motion.zoom.jump(0.75);
  motion.renderIndex.jump(1);
  const shown = motion.shown();
  expect(shown).not.toBe(1);
  motion.apply(frameOf([placed('a', 0)], { zoom: 1, renderIndex: 0 }));
  expect(motion.shown()).toBeCloseTo(shown, 9);
  expect(motion.renderIndex.isAnimating()).toBe(true);
});

const THREE = [
  { id: 'first', index: 0, viewX: -4 },
  { id: 'empty', index: 1, viewX: 0 },
  { id: 'third', index: 2, viewX: -4 },
];

const LEFT = [THREE[0], { ...THREE[2], index: 1 }];

test('keeps a removed workspace in place until the switch settles', async () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { spaces: THREE, renderIndex: 1 }));
  await vi.waitFor(() => expect(motion.renderIndex.get()).toBe(1));
  motion.apply(frameOf([placed('a', 0)], { spaces: LEFT, renderIndex: 1 }));
  const third = motion.space('third');
  expect(third.index.get()).toBe(2);
  expect(motion.renderIndex.get()).toBe(1);
  expect(motion.renderIndex.isAnimating()).toBe(true);
  await vi.waitFor(() => expect(third.index.get()).toBe(1));
  expect(motion.renderIndex.get()).toBe(1);
  motion.apply(frameOf([placed('a', 0)], { spaces: LEFT, renderIndex: 0 }));
  expect(motion.renderIndex.isAnimating()).toBe(true);
});

test('closes the place of a removed workspace at once while the stack rests', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { spaces: THREE }));
  motion.apply(frameOf([placed('a', 0)], { spaces: LEFT }));
  expect(motion.space('third').index.get()).toBe(1);
});

test('closes the place of a removed workspace when a gesture takes over', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { spaces: THREE, renderIndex: 1 }));
  motion.renderIndex.jump(1);
  motion.apply(frameOf([placed('a', 0)], { spaces: LEFT, renderIndex: 1 }));
  motion.apply(
    frameOf([placed('a', 0)], {
      spaces: LEFT,
      renderIndex: 0.5,
      tracking: 'all',
    }),
  );
  expect(motion.space('third').index.get()).toBe(1);
  expect(motion.renderIndex.get()).toBe(0.5);
});

test('drops a workspace removed during a gesture at once', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { spaces: THREE }));
  motion.apply(frameOf([placed('a', 0)], { spaces: LEFT, tracking: 'all' }));
  expect(motion.space('third').index.get()).toBe(1);
});

test('keeps the closed overview on its workspace when one above goes', async () => {
  const motion = ready([placed('a', 0)]);
  const at = (extra: Partial<Frame>) =>
    motion.apply(frameOf([placed('a', 0)], extra));
  at({ spaces: THREE, zoom: 0.5 });
  await vi.waitFor(() => expect(motion.zoom.get()).toBe(0.5));
  at({ spaces: THREE, zoom: 1, renderIndex: 2 });
  await vi.waitFor(() => expect(motion.shown()).toBe(2));
  await vi.waitFor(() => expect(motion.zoom.get()).toBe(1));
  at({ spaces: LEFT, renderIndex: 1 });
  await vi.waitFor(() => expect(motion.space('third').index.get()).toBe(1));
  expect(motion.shown()).toBe(1);
  expect(motion.renderIndex.isAnimating()).toBe(false);
});

const LET_GO = { x: 300, y: 50, width: 100, height: 200 };

function droppedOn(spaces: Frame['spaces'], into = 'second') {
  const motion = ready([placed('a', 0)]);
  const tile = motion.tile(placed('a', 0));
  const first = { id: 'first', index: 0, viewX: -4 };
  const second = { id: 'second', index: 1, viewX: 10 };
  motion.apply(frameOf([placed('a', 0)], { spaces: [first, second] }));
  const dragged = placed('a', 0, { dragged: true, rect: LET_GO });
  motion.apply(
    frameOf([dragged], { spaces: [first, second], tracking: 'view' }),
  );
  const landed = placed('a', 0, { workspaceId: into, rect: LET_GO });
  motion.apply(frameOf([landed], { spaces: [first, ...spaces] }));
  return tile;
}

test('glides a pane dropped on another workspace from where it was let go', () => {
  const tile = droppedOn([{ id: 'second', index: 1, viewX: 40 }]);
  expect([tile.x.get(), tile.y.get()]).toEqual([314, 50 - 880]);
  expect([tile.x.isAnimating(), tile.y.isAnimating()]).toEqual([true, true]);
});

test('takes the view a new workspace opens with for a pane dropped there', () => {
  const tile = droppedOn(
    [
      { id: 'second', index: 2, viewX: 10 },
      { id: 'fresh', index: 1, viewX: 40 },
    ],
    'fresh',
  ).x;
  expect(tile.get()).toBe(344);
});

test('opens a pane it has not drawn before', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0), placed('c', 200)]));
  expect(motion.tile(placed('c', 200)).opacity.isAnimating()).toBe(true);
});

test('shows a workspace that comes back with its own view', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { spaces: THREE }));
  motion.apply(frameOf([placed('a', 0)], { spaces: LEFT }));
  const back = [THREE[0], { ...THREE[1], viewX: 300 }, THREE[2]];
  motion.apply(frameOf([placed('a', 0)], { spaces: back }));
  expect(motion.space('empty').viewX.get()).toBe(300);
});

test('closes the place of a removed workspace for a gesture while zooming', () => {
  const motion = ready([placed('a', 0)]);
  motion.apply(frameOf([placed('a', 0)], { spaces: THREE }));
  motion.apply(frameOf([placed('a', 0)], { spaces: LEFT, zoom: 0.5 }));
  expect(motion.space('third').index.get()).toBe(2);
  motion.apply(
    frameOf([placed('a', 0)], { spaces: LEFT, zoom: 0.5, tracking: 'all' }),
  );
  expect(motion.space('third').index.get()).toBe(1);
});

test('moves workspaces to their new place while the stack still slides', () => {
  const two = [
    { id: 'first', index: 0, viewX: -4 },
    { id: 'second', index: 1, viewX: -4 },
  ];
  const motion = new LayoutMotion();
  motion.apply(frameOf([], { spaces: two }));
  motion.apply(
    frameOf([], {
      spaces: [
        { ...two[1], index: 0 },
        { ...two[0], index: 1 },
      ],
      renderIndex: 1,
    }),
  );
  expect(motion.renderIndex.isAnimating()).toBe(true);
  expect(motion.space('first').index.get()).toBe(1);
  expect(motion.space('second').index.get()).toBe(0);
});
