import { BadRequestException, NotFoundException } from '@nestjs/common';
import { changeSpace, layoutChange } from './layout-actions.js';
import { focusColumnLeft } from './scrolling-moves.js';
import type { WorkspaceAction } from './layout.schemas.js';
import { layout, sketches } from '../test/sketch.js';

const START = ['A | B C* | D', 'E*', ''];

function after(action: WorkspaceAction, start = layout(START)): string[] {
  return sketches(layoutChange(start, action));
}

it.each([
  ['focusWorkspaceUp', ['> A | B C* | D', 'E*', '']],
  ['focusWorkspaceDown', ['A | B C* | D', '> E*', '']],
  ['moveWindowToWorkspaceUp', ['> A | B C* | D', 'E*', '']],
  ['moveWindowToWorkspaceDown', ['A | B* | D', '> E | C*', '']],
  ['moveColumnToWorkspaceUp', ['> A | B C* | D', 'E*', '']],
  ['moveColumnToWorkspaceDown', ['A | D*', '> E | B C*', '']],
  ['moveWorkspaceUp', ['> A | B C* | D', 'E*', '']],
  ['moveWorkspaceDown', ['E*', '> A | B C* | D', '']],
  ['focusWindowOrWorkspaceUp', ['> A | B* C | D', 'E*', '']],
  ['focusWindowOrWorkspaceDown', ['A | B C* | D', '> E*', '']],
  ['moveWindowUpOrToWorkspaceUp', ['> A | C* B | D', 'E*', '']],
  ['moveWindowDownOrToWorkspaceDown', ['A | B* | D', '> E | C*', '']],
] as const)('applies %s to the focus', (action, sketched) => {
  expect(after({ action })).toEqual(sketched);
});

it('applies the moves up from the second workspace', () => {
  const lower = layout(['A*', 'B | C*', ''], 1);
  expect(after({ action: 'moveWindowToWorkspaceUp' }, lower)).toEqual([
    '> A | C*',
    'B*',
    '',
  ]);
  expect(after({ action: 'moveColumnToWorkspaceUp' }, lower)).toEqual([
    '> A | C*',
    'B*',
    '',
  ]);
  expect(after({ action: 'moveWorkspaceUp' }, lower)).toEqual([
    '> B | C*',
    'A*',
    '',
  ]);
  expect(after({ action: 'focusWorkspaceUp' }, lower)).toEqual([
    '> A*',
    'B | C*',
    '',
  ]);
});

it('focuses the pane, column or workspace it is given', () => {
  expect(after({ action: 'focusPane', paneId: 'E' })).toEqual([
    'A | B C* | D',
    '> E*',
    '',
  ]);
  const strips = layout(START);
  const columnId = strips.workspaces[0].columns[0].id;
  expect(after({ action: 'focusColumn', columnId }, strips)).toEqual([
    '> A* | B C^ | D',
    'E*',
    '',
  ]);
  const lower = layout(['A*', 'B | C*', '']);
  const [, second] = lower.workspaces;
  expect(
    after(
      {
        action: 'focusColumn',
        columnId: second.columns[0].id,
        workspaceId: second.id,
      },
      lower,
    ),
  ).toEqual(['> A*', 'B* | C', '']);
  const workspaceId = strips.workspaces[1].id;
  expect(after({ action: 'focusWorkspace', workspaceId }, strips)).toEqual([
    'A | B C* | D',
    '> E*',
    '',
  ]);
});

it('refuses columns out of view and workspaces it does not know', () => {
  const strips = layout(START);
  const columnId = strips.workspaces[1].columns[0].id;
  expect(() =>
    layoutChange(strips, { action: 'focusColumn', columnId }),
  ).toThrow(new NotFoundException(`There is no column ${columnId} in view`));
  const elsewhere = strips.workspaces[0].columns[0].id;
  const workspaceId = strips.workspaces[1].id;
  expect(() =>
    layoutChange(strips, {
      action: 'focusColumn',
      columnId: elsewhere,
      workspaceId,
    }),
  ).toThrow(new NotFoundException(`There is no column ${elsewhere} in view`));
  expect(() =>
    layoutChange(strips, { action: 'focusWorkspace', workspaceId: 'nowhere' }),
  ).toThrow(new NotFoundException('There is no workspace nowhere'));
});

it('moves and resizes the pane it is given', () => {
  expect(after({ action: 'movePane', paneId: 'A', column: 2 })).toEqual([
    '> B C^ | D | A*',
    'E*',
    '',
  ]);
  expect(() =>
    layoutChange(layout(START), { action: 'movePane', paneId: 'A', column: 4 }),
  ).toThrow(new BadRequestException('There is no such drop place'));
  const resized = layoutChange(layout(START), {
    action: 'resizePane',
    paneId: 'A',
    width: 0.4,
  });
  expect(resized.workspaces[0].columns[0].width).toBe(0.4);
});

it('moves the pane it is given into a new workspace', () => {
  expect(
    after({ action: 'movePaneToNewWorkspace', paneId: 'E', index: 0 }),
  ).toEqual(['E*', '> A | B C* | D', '']);
});

it('changes the workspace it is given or the focused one', () => {
  const strips = layout(START, 1);
  const workspaceId = strips.workspaces[0].id;
  expect(sketches(changeSpace(strips, workspaceId, focusColumnLeft))).toEqual([
    'A* | B C^ | D',
    '> E*',
    '',
  ]);
  expect(sketches(changeSpace(strips, undefined, focusColumnLeft))).toEqual(
    sketches(strips),
  );
  expect(() => changeSpace(strips, 'nowhere', focusColumnLeft)).toThrow(
    new NotFoundException('There is no workspace nowhere'),
  );
});
