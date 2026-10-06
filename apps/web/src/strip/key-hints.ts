import type { LayoutMap } from './key-layout';
import { BINDINGS, OVERVIEW_BINDINGS } from './keys';
import type { Command } from './types';

const GROUPS = [
  'Focus',
  'Move',
  'Workspaces',
  'Size',
  'Panes',
  'Overview',
] as const;

type Group = (typeof GROUPS)[number];

export type HintRow = { label: string; modifiers: string[]; keys: string[] };

export type HintGroup = { name: Group; rows: HintRow[] };

const LABELS: Record<string, [Group, string]> = {
  focusColumnLeft: ['Focus', 'Column left'],
  focusColumnRight: ['Focus', 'Column right'],
  focusWindowOrWorkspaceUp: ['Focus', 'Pane above'],
  focusWindowOrWorkspaceDown: ['Focus', 'Pane below'],
  moveColumnLeft: ['Move', 'Column left'],
  moveColumnRight: ['Move', 'Column right'],
  moveWindowUpOrToWorkspaceUp: ['Move', 'Pane up'],
  moveWindowDownOrToWorkspaceDown: ['Move', 'Pane down'],
  focusWorkspaceUp: ['Workspaces', 'Workspace above'],
  focusWorkspaceDown: ['Workspaces', 'Workspace below'],
  moveColumnToWorkspaceUp: ['Workspaces', 'Send column up'],
  moveColumnToWorkspaceDown: ['Workspaces', 'Send column down'],
  moveWindowToWorkspaceUp: ['Workspaces', 'Send pane up'],
  moveWindowToWorkspaceDown: ['Workspaces', 'Send pane down'],
  moveWorkspaceUp: ['Workspaces', 'Move workspace up'],
  moveWorkspaceDown: ['Workspaces', 'Move workspace down'],
  'setColumnWidth-1': ['Size', 'Narrower column'],
  setColumnWidth1: ['Size', 'Wider column'],
  'setWindowHeight-1': ['Size', 'Shorter pane'],
  setWindowHeight1: ['Size', 'Taller pane'],
  resetWindowHeight: ['Size', 'Reset pane height'],
  maximizeColumn: ['Size', 'Maximize column'],
  expand: ['Size', 'Fill the free width'],
  open: ['Panes', 'Open pane'],
  close: ['Panes', 'Close pane'],
  consumeOrExpelWindowLeft: ['Panes', 'Consume or expel left'],
  consumeOrExpelWindowRight: ['Panes', 'Consume or expel right'],
  consumeWindowIntoColumn: ['Panes', 'Consume into column'],
  expelWindowFromColumn: ['Panes', 'Expel from column'],
  overview: ['Overview', 'Toggle overview'],
};

const OVERVIEW_LABELS: Record<string, string> = { overview: 'Close overview' };

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Minus: '-',
  Equal: '=',
  Escape: 'Esc',
};

function idOf(command: Command): string {
  if (typeof command === 'string') return command;
  if (!('change' in command)) return command.action;
  return `${command.action}${Math.sign(command.change)}`;
}

function capital(key: string): string {
  const upper = key.toUpperCase();
  return upper.length === 1 ? upper : key;
}

function keyName(code: string, layout: LayoutMap): string {
  const typed = layout.get(code);
  if (typed) return capital(typed);
  return KEY_NAMES[code] ?? code.replace('Key', '');
}

function isLetter(code: string): boolean {
  return code.startsWith('Key');
}

function letterFirst(codes: string[]): string[] {
  return [
    ...codes.filter(isLetter),
    ...codes.filter((code) => !isLetter(code)),
  ];
}

type Entry = { group: Group; label: string; modifiers: string[] };

type Row = Entry & { codes: string[] };

function newRow([group, label]: [Group, string], held: string): Row {
  return { group, label, modifiers: held ? held.split('+') : [], codes: [] };
}

function rowsOf(
  bindings: ReadonlyMap<string, Command>,
  entryOf: (id: string) => [Group, string],
) {
  const rows = new Map<string, Row>();
  for (const [chord, command] of bindings) {
    const cut = chord.lastIndexOf('+');
    const held = chord.slice(0, Math.max(cut, 0));
    const key = `${idOf(command)}|${held}`;
    const row = rows.get(key) ?? newRow(entryOf(idOf(command)), held);
    row.codes.push(chord.slice(cut + 1));
    rows.set(key, row);
  }
  return [...rows.values()];
}

function overviewEntry(id: string): [Group, string] {
  return ['Overview', OVERVIEW_LABELS[id] ?? LABELS[id][1]];
}

export function keyHints(overview: boolean, layout: LayoutMap): HintGroup[] {
  const rows = [
    ...rowsOf(BINDINGS, (id) => LABELS[id]),
    ...(overview ? rowsOf(OVERVIEW_BINDINGS, overviewEntry) : []),
  ];
  return GROUPS.map((name) => ({
    name,
    rows: rows
      .filter(({ group }) => group === name)
      .map(({ label, modifiers, codes }) => ({
        label,
        modifiers,
        keys: letterFirst(codes).map((code) => keyName(code, layout)),
      })),
  }));
}
