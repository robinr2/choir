import { expect, test } from 'vitest';
import { chord, commandFor } from './keys';

function key(code: string, held: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', { code, altKey: true, ...held });
}

function bound(code: string, held?: KeyboardEventInit) {
  return commandFor(key(code, held));
}

test('names a chord by its modifiers and physical key', () => {
  expect(chord(key('KeyQ'))).toBe('Alt+KeyQ');
  expect(
    chord(key('KeyU', { ctrlKey: true, shiftKey: true, metaKey: true })),
  ).toBe('Alt+Ctrl+Shift+Meta+KeyU');
  expect(chord(new KeyboardEvent('keydown', { code: 'KeyJ' }))).toBe('KeyJ');
});

test("binds niri's default keys with Alt as the modifier", () => {
  expect(bound('KeyQ')).toBe('close');
  expect(bound('KeyJ')).toEqual({ action: 'focusWindowDown' });
  expect(bound('ArrowDown')).toEqual({ action: 'focusWindowDown' });
  expect(bound('KeyK')).toEqual({ action: 'focusWindowUp' });
  expect(bound('ArrowUp')).toEqual({ action: 'focusWindowUp' });
  expect(bound('KeyL')).toEqual({ action: 'focusColumnRight' });
  const ctrl = { ctrlKey: true };
  expect(bound('KeyH', ctrl)).toEqual({ action: 'moveColumnLeft' });
  expect(bound('ArrowLeft', ctrl)).toEqual({ action: 'moveColumnLeft' });
  expect(bound('KeyL', ctrl)).toEqual({ action: 'moveColumnRight' });
  expect(bound('ArrowRight', ctrl)).toEqual({ action: 'moveColumnRight' });
  expect(bound('KeyJ', ctrl)).toEqual({ action: 'moveWindowDown' });
  expect(bound('ArrowDown', ctrl)).toEqual({ action: 'moveWindowDown' });
  expect(bound('KeyK', ctrl)).toEqual({ action: 'moveWindowUp' });
  expect(bound('ArrowUp', ctrl)).toEqual({ action: 'moveWindowUp' });
});

test('binds the workspace keys', () => {
  const ctrl = { ctrlKey: true };
  const shift = { shiftKey: true };
  const both = { ctrlKey: true, shiftKey: true };
  expect(bound('PageDown')).toEqual({ action: 'focusWorkspaceDown' });
  expect(bound('KeyU')).toEqual({ action: 'focusWorkspaceDown' });
  expect(bound('PageUp')).toEqual({ action: 'focusWorkspaceUp' });
  expect(bound('KeyI')).toEqual({ action: 'focusWorkspaceUp' });
  const down = { action: 'moveColumnToWorkspaceDown' };
  expect(bound('PageDown', ctrl)).toEqual(down);
  expect(bound('KeyU', ctrl)).toEqual(down);
  const up = { action: 'moveColumnToWorkspaceUp' };
  expect(bound('PageUp', ctrl)).toEqual(up);
  expect(bound('KeyI', ctrl)).toEqual(up);
  expect(bound('PageDown', shift)).toEqual({ action: 'moveWorkspaceDown' });
  expect(bound('KeyU', shift)).toEqual({ action: 'moveWorkspaceDown' });
  expect(bound('PageUp', shift)).toEqual({ action: 'moveWorkspaceUp' });
  const windowDown = { action: 'moveWindowToWorkspaceDown' };
  expect(bound('PageDown', both)).toEqual(windowDown);
  expect(bound('KeyU', both)).toEqual(windowDown);
  const windowUp = { action: 'moveWindowToWorkspaceUp' };
  expect(bound('PageUp', both)).toEqual(windowUp);
  expect(bound('KeyI', both)).toEqual(windowUp);
});

test('binds the column and size keys', () => {
  expect(bound('BracketLeft')).toEqual({ action: 'consumeOrExpelWindowLeft' });
  expect(bound('BracketRight')).toEqual({
    action: 'consumeOrExpelWindowRight',
  });
  expect(bound('Comma')).toEqual({ action: 'consumeWindowIntoColumn' });
  expect(bound('Period')).toEqual({ action: 'expelWindowFromColumn' });
  expect(bound('Minus')).toEqual({ action: 'setColumnWidth', change: -10 });
  expect(bound('Equal')).toEqual({ action: 'setColumnWidth', change: 10 });
  const shift = { shiftKey: true };
  expect(bound('Minus', shift)).toEqual({
    action: 'setWindowHeight',
    change: -10,
  });
  expect(bound('Equal', shift)).toEqual({
    action: 'setWindowHeight',
    change: 10,
  });
  expect(bound('KeyR', { ctrlKey: true })).toEqual({
    action: 'resetWindowHeight',
  });
  expect(bound('KeyF', { ctrlKey: true })).toBe('expand');
});

test('leaves the browser keys and repeated closes alone', () => {
  for (const code of ['ArrowLeft', 'ArrowRight', 'KeyH', 'KeyT', 'KeyF']) {
    expect(commandFor(key(code))).toBeUndefined();
  }
  expect(commandFor(key('KeyI', { shiftKey: true }))).toBeUndefined();
  expect(commandFor(key('KeyQ', { repeat: true }))).toBeUndefined();
  expect(commandFor(key('KeyJ', { repeat: true }))).toEqual({
    action: 'focusWindowDown',
  });
  expect(commandFor(new KeyboardEvent('keydown', { code: 'KeyQ' }))).toBe(
    undefined,
  );
});
