import {
  focusColumnLeft,
  focusColumnRight,
  focusWindowDown,
  focusWindowUp,
  moveColumnLeft,
  moveColumnRight,
  moveWindowDown,
  moveWindowUp,
} from './scrolling-moves.js';
import { after, space } from '../test/sketch.js';

describe('focus', () => {
  it('moves between columns and stops at the first and the last', () => {
    expect(after(focusColumnLeft, 'A | B*')).toBe('A* | B');
    expect(after(focusColumnLeft, 'A* | B')).toBe('A* | B');
    expect(after(focusColumnRight, 'A* | B')).toBe('A | B*');
    expect(after(focusColumnRight, 'A | B*')).toBe('A | B*');
    expect(after(focusColumnRight, '')).toBe('');
  });

  it('keeps the active pane of every column', () => {
    expect(after(focusColumnLeft, 'A B^ | C*')).toBe('A B* | C');
  });

  it('forgets the column to go back to', () => {
    expect(focusColumnLeft(space('A | B*', true)).restoresPrevious).toBe(false);
  });

  it('moves between panes of a column and stops at the top and the bottom', () => {
    expect(after(focusWindowDown, 'A* B')).toBe('A B*');
    expect(after(focusWindowDown, 'A B*')).toBe('A B*');
    expect(after(focusWindowUp, 'A B*')).toBe('A* B');
    expect(after(focusWindowUp, 'A* B')).toBe('A* B');
    expect(after(focusWindowUp, '')).toBe('');
  });

  it('remembers the column to go back to across focus inside the column', () => {
    expect(focusWindowUp(space('A | B C*', true)).restoresPrevious).toBe(true);
  });
});

describe('move', () => {
  it('moves the focused column with focus and stops at the edges', () => {
    expect(after(moveColumnLeft, 'A | B | C*')).toBe('A | C* | B');
    expect(after(moveColumnLeft, 'A* | B')).toBe('A* | B');
    expect(after(moveColumnRight, 'A* | B | C')).toBe('B | A* | C');
    expect(after(moveColumnRight, 'A | B*')).toBe('A | B*');
    expect(after(moveColumnRight, '')).toBe('');
    expect(after(moveColumnLeft, '')).toBe('');
  });

  it('forgets the column to go back to when a column moves', () => {
    expect(moveColumnLeft(space('A | B*', true)).restoresPrevious).toBe(false);
  });

  it('moves the focused pane in its column with focus', () => {
    expect(after(moveWindowDown, 'A* B C')).toBe('B A* C');
    expect(after(moveWindowDown, 'A B*')).toBe('A B*');
    expect(after(moveWindowUp, 'A B C*')).toBe('A C* B');
    expect(after(moveWindowUp, 'A* B')).toBe('A* B');
    expect(after(moveWindowUp, '')).toBe('');
  });
});
