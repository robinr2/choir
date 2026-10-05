import type { SimpleAction } from '@/workspace/core-workspace';
import type { Command } from './types';

function act(action: SimpleAction): Command {
  return { action };
}

function both(keys: readonly string[], command: Command) {
  return keys.map((key) => [key, command] as const);
}

export const BINDINGS = new Map<string, Command>([
  ['Alt+KeyQ', 'close'],
  ...both(['Alt+ArrowDown', 'Alt+KeyJ'], act('focusWindowOrWorkspaceDown')),
  ...both(['Alt+ArrowUp', 'Alt+KeyK'], act('focusWindowOrWorkspaceUp')),
  ['Alt+KeyT', 'open'],
  ['Alt+KeyO', 'overview'],
  ...both(['Alt+ArrowLeft', 'Alt+KeyH'], act('focusColumnLeft')),
  ...both(['Alt+ArrowRight', 'Alt+KeyL'], act('focusColumnRight')),
  ...both(['Alt+Ctrl+ArrowLeft', 'Alt+Ctrl+KeyH'], act('moveColumnLeft')),
  ...both(['Alt+Ctrl+ArrowRight', 'Alt+Ctrl+KeyL'], act('moveColumnRight')),
  ...both(
    ['Alt+Ctrl+ArrowDown', 'Alt+Ctrl+KeyJ'],
    act('moveWindowDownOrToWorkspaceDown'),
  ),
  ...both(
    ['Alt+Ctrl+ArrowUp', 'Alt+Ctrl+KeyK'],
    act('moveWindowUpOrToWorkspaceUp'),
  ),
  ...both(['Alt+PageDown', 'Alt+KeyU'], act('focusWorkspaceDown')),
  ...both(['Alt+PageUp', 'Alt+KeyI'], act('focusWorkspaceUp')),
  ...both(
    ['Alt+Ctrl+PageDown', 'Alt+Ctrl+KeyU'],
    act('moveColumnToWorkspaceDown'),
  ),
  ...both(['Alt+Ctrl+PageUp', 'Alt+Ctrl+KeyI'], act('moveColumnToWorkspaceUp')),
  ...both(['Alt+Shift+PageDown', 'Alt+Shift+KeyU'], act('moveWorkspaceDown')),
  ...both(['Alt+Shift+PageUp', 'Alt+Shift+KeyI'], act('moveWorkspaceUp')),
  ...both(
    ['Alt+Ctrl+Shift+PageDown', 'Alt+Ctrl+Shift+KeyU'],
    act('moveWindowToWorkspaceDown'),
  ),
  ...both(
    ['Alt+Ctrl+Shift+PageUp', 'Alt+Ctrl+Shift+KeyI'],
    act('moveWindowToWorkspaceUp'),
  ),
  ['Alt+BracketLeft', act('consumeOrExpelWindowLeft')],
  ['Alt+BracketRight', act('consumeOrExpelWindowRight')],
  ['Alt+Comma', act('consumeWindowIntoColumn')],
  ['Alt+Period', act('expelWindowFromColumn')],
  ['Alt+Minus', { action: 'setColumnWidth', change: -10 }],
  ['Alt+Equal', { action: 'setColumnWidth', change: 10 }],
  ['Alt+Shift+Minus', { action: 'setWindowHeight', change: -10 }],
  ['Alt+Shift+Equal', { action: 'setWindowHeight', change: 10 }],
  ['Alt+Ctrl+KeyR', act('resetWindowHeight')],
  ['Alt+KeyF', act('maximizeColumn')],
  ['Alt+Ctrl+KeyF', 'expand'],
]);

export const OVERVIEW_BINDINGS = new Map<string, Command>([
  ['Escape', 'overview'],
  ['Enter', 'overview'],
  ['ArrowLeft', act('focusColumnLeft')],
  ['ArrowRight', act('focusColumnRight')],
  ['ArrowUp', act('focusWindowOrWorkspaceUp')],
  ['ArrowDown', act('focusWindowOrWorkspaceDown')],
]);

const ONCE = new Set<Command>(['close', 'overview']);

const MODIFIERS = [
  ['altKey', 'Alt'],
  ['ctrlKey', 'Ctrl'],
  ['shiftKey', 'Shift'],
  ['metaKey', 'Meta'],
] as const;

export function chord(event: KeyboardEvent): string {
  const held = MODIFIERS.filter(([key]) => event[key]).map(([, name]) => name);
  return [...held, event.code].join('+');
}

function lookup(name: string, overview: boolean): Command | undefined {
  const command = BINDINGS.get(name);
  if (command || !overview) return command;
  return OVERVIEW_BINDINGS.get(name);
}

export function commandFor(
  event: KeyboardEvent,
  overview = false,
): Command | undefined {
  const command = lookup(chord(event), overview);
  if (event.repeat && command && ONCE.has(command)) return undefined;
  return command;
}
