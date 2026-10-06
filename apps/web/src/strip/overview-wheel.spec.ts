import { expect, test } from 'vitest';
import { OverviewWheel } from './overview-wheel';

function wheel(init: WheelEventInit, timeStamp = 0): WheelEvent {
  const event = new WheelEvent('wheel', init);
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
}

test('switches workspaces with the plain vertical wheel, once per 50 ms', () => {
  const binds = new OverviewWheel();
  expect(binds.commands(wheel({ deltaY: 240 }, 1000), 'w')).toEqual([
    { action: 'focusWorkspaceDown' },
  ]);
  expect(binds.commands(wheel({ deltaY: 120 }, 1049), 'w')).toEqual([]);
  expect(binds.commands(wheel({ deltaY: -120 }, 1050), 'w')).toEqual([
    { action: 'focusWorkspaceUp' },
  ]);
});

test('focuses columns on the workspace under the pointer', () => {
  const binds = new OverviewWheel();
  expect(binds.commands(wheel({ deltaX: 240 }), 'w')).toEqual([
    { action: 'focusColumnRight', workspaceId: 'w' },
    { action: 'focusColumnRight', workspaceId: 'w' },
  ]);
  expect(binds.commands(wheel({ deltaX: -120 }), 'v')).toEqual([
    { action: 'focusColumnLeft', workspaceId: 'v' },
  ]);
  expect(binds.commands(wheel({ deltaX: -120 }), undefined)).toEqual([]);
  expect(binds.commands(wheel({ deltaX: 3, deltaMode: 1 }), 'w')).toEqual([
    { action: 'focusColumnRight', workspaceId: 'w' },
  ]);
});

test('lets wheel events without a step leave the cooldown alone', () => {
  const binds = new OverviewWheel();
  expect(binds.commands(wheel({ deltaY: 120 }, 1000), 'w')).toHaveLength(1);
  expect(binds.commands(wheel({ deltaY: 0 }, 1060), 'w')).toEqual([]);
  expect(binds.commands(wheel({ deltaY: 120 }, 1070), 'w')).toEqual([
    { action: 'focusWorkspaceDown' },
  ]);
});

test('focuses columns with Shift and the vertical wheel, once per 50 ms', () => {
  const binds = new OverviewWheel();
  const shifted = { shiftKey: true };
  expect(
    binds.commands(wheel({ deltaY: 3, deltaMode: 1, ...shifted }, 0), 'w'),
  ).toEqual([{ action: 'focusColumnRight', workspaceId: 'w' }]);
  expect(binds.commands(wheel({ deltaY: 120, ...shifted }, 10), 'w')).toEqual(
    [],
  );
  expect(binds.commands(wheel({ deltaY: -120, ...shifted }, 60), 'w')).toEqual([
    { action: 'focusColumnLeft', workspaceId: 'w' },
  ]);
});

test('leaves the wheel with other modifiers to the usual bindings', () => {
  const binds = new OverviewWheel();
  for (const held of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    expect(binds.commands(wheel({ deltaY: 240, ...held }), 'w')).toEqual([]);
  }
});
