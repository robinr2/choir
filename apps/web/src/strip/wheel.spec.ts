import { expect, test } from 'vitest';
import { WheelBinds } from './wheel';

function wheel(init: WheelEventInit, timeStamp = 0): WheelEvent {
  const event = new WheelEvent('wheel', { altKey: true, ...init });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
}

test('ignores the wheel without Alt', () => {
  expect(
    new WheelBinds().commands(new WheelEvent('wheel', { deltaY: 500 })),
  ).toEqual([]);
});

test('switches workspaces with the vertical wheel, once per cooldown', () => {
  const binds = new WheelBinds();
  expect(binds.commands(wheel({ deltaY: 120 }, 1000))).toEqual([
    'focusWorkspaceDown',
  ]);
  expect(binds.commands(wheel({ deltaY: 120 }, 1149))).toEqual([]);
  expect(binds.commands(wheel({ deltaY: -120 }, 1150))).toEqual([
    'focusWorkspaceUp',
  ]);
  expect(binds.commands(wheel({ deltaY: 60 }, 1400))).toEqual([]);
  expect(binds.commands(wheel({ deltaY: 3, deltaMode: 1 }, 1400))).toEqual([
    'focusWorkspaceDown',
  ]);
});

test('moves the column to another workspace with Ctrl', () => {
  const binds = new WheelBinds();
  expect(
    binds.commands(wheel({ deltaY: 1, deltaMode: 2, ctrlKey: true }, 0)),
  ).toEqual(['moveColumnToWorkspaceDown']);
  expect(binds.commands(wheel({ deltaY: -240, ctrlKey: true }, 200))).toEqual([
    'moveColumnToWorkspaceUp',
  ]);
});

test('moves along the strip with the horizontal or the Shift wheel', () => {
  const binds = new WheelBinds();
  expect(binds.commands(wheel({ deltaX: 240 }))).toEqual([
    'focusColumnRight',
    'focusColumnRight',
  ]);
  expect(binds.commands(wheel({ deltaY: -120, shiftKey: true }))).toEqual([
    'focusColumnLeft',
  ]);
  expect(binds.commands(wheel({ deltaX: 120, shiftKey: true }))).toEqual([
    'focusColumnRight',
  ]);
  expect(binds.commands(wheel({ deltaX: -120, ctrlKey: true }))).toEqual([
    'moveColumnLeft',
  ]);
  expect(
    binds.commands(wheel({ deltaY: 120, ctrlKey: true, shiftKey: true })),
  ).toEqual(['moveColumnRight']);
  expect(binds.commands(wheel({ deltaX: 50 }))).toEqual([]);
});

test('scales line-wise wheels on both axes', () => {
  expect(new WheelBinds().commands(wheel({ deltaX: 3, deltaMode: 1 }))).toEqual(
    ['focusColumnRight'],
  );
});

test('keeps each axis counting in its own direction', () => {
  const binds = new WheelBinds();
  expect(binds.commands(wheel({ deltaY: 60 }, 0))).toEqual([]);
  expect(binds.commands(wheel({ deltaX: 60 }, 0))).toEqual([]);
  expect(binds.commands(wheel({ deltaY: -60 }, 0))).toEqual([]);
  expect(binds.commands(wheel({ deltaX: -60 }, 0))).toEqual([]);
  expect(binds.commands(wheel({ deltaY: -60, deltaX: -60 }, 0))).toEqual([
    'focusColumnLeft',
    'focusWorkspaceUp',
  ]);
});
