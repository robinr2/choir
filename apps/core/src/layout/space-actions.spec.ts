import type { LayoutAction, SpaceAction } from './layout.schemas.js';
import { isSpaceAction, spaceChange, workspaceOf } from './space-actions.js';
import { space, sketch } from '../test/sketch.js';

const START = 'A | B C* | D';

function after(action: SpaceAction, start = START): string {
  return sketch(spaceChange(action)(space(start)));
}

it.each([
  ['focusColumnLeft', 'A* | B C^ | D'],
  ['focusColumnRight', 'A | B C^ | D*'],
  ['focusWindowUp', 'A | B* C | D'],
  ['focusWindowDown', 'A | B C* | D'],
  ['moveColumnLeft', 'B C* | A | D'],
  ['moveColumnRight', 'A | D | B C*'],
  ['moveWindowUp', 'A | C* B | D'],
  ['moveWindowDown', 'A | B C* | D'],
  ['consumeOrExpelWindowLeft', 'A | C* | B | D'],
  ['consumeOrExpelWindowRight', 'A | B | C* | D'],
  ['consumeWindowIntoColumn', 'A | B C* D'],
  ['expelWindowFromColumn', 'A | B* | C | D'],
] as const)('applies %s to the focus', (action, sketched) => {
  expect(after({ action })).toBe(sketched);
});

it('changes the sizes of the focused column and pane', () => {
  const sized = (action: SpaceAction) =>
    spaceChange(action)(space(START)).columns[1];
  expect(sized({ action: 'setColumnWidth', change: 20 }).width).toBe(0.7);
  expect(sized({ action: 'maximizeColumn' }).fullWidth).toBe(true);
  const taller = sized({ action: 'setWindowHeight', change: 10 });
  expect(taller).toMatchObject({ width: 0.5 });
  expect(taller.tiles[1].height).toEqual({ fixed: 0.6 });
  const reset = spaceChange({ action: 'resetWindowHeight' })({
    ...space(START),
    columns: space(START).columns.with(1, taller),
  });
  expect(reset.columns[1].tiles[1].height).toEqual({ auto: 1 });
  const strip = space('A | B*');
  strip.columns[0].width = 0.25;
  const expanded = spaceChange({
    action: 'expandColumnToAvailableWidth',
    visibleColumns: strip.columns.map(({ id }) => id),
  })(strip);
  expect(expanded.columns[1].width).toBe(0.75);
});

it('tells the actions on the focused workspace from the others', () => {
  const inSpace: LayoutAction[] = [
    { action: 'focusColumnLeft' },
    { action: 'setColumnWidth', change: 10 },
    { action: 'setWindowHeight', change: 10 },
    { action: 'expandColumnToAvailableWidth', visibleColumns: [] },
  ];
  const elsewhere: LayoutAction[] = [
    { action: 'focusWorkspaceUp' },
    { action: 'focusPane', paneId: 'A' },
    { action: 'focusColumn', columnId: 'c' },
  ];
  expect(inSpace.map(isSpaceAction)).toEqual([true, true, true, true]);
  expect(elsewhere.map(isSpaceAction)).toEqual([false, false, false]);
});

it('names the workspace an action targets', () => {
  expect(workspaceOf({ action: 'focusColumnLeft', workspaceId: 'W' })).toBe(
    'W',
  );
  expect(workspaceOf({ action: 'focusColumnLeft' })).toBeUndefined();
  expect(workspaceOf({ action: 'setColumnWidth', change: 10 })).toBeUndefined();
});
