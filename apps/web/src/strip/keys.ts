import type { SimpleAction } from '@/workspace/core-workspace';
import type { Command } from './types';

function act(action: SimpleAction): Command {
  return { action };
}

function both(keys: readonly string[], command: Command) {
  return keys.map((key) => [key, command] as const);
}

const BINDINGS = new Map<string, Command>([
  ['Alt+KeyQ', 'close'],
  ...both(['Alt+ArrowDown', 'Alt+KeyJ'], act('focusWindowDown')),
  ...both(['Alt+ArrowUp', 'Alt+KeyK'], act('focusWindowUp')),
  ['Alt+KeyL', act('focusColumnRight')],
  ...both(['Alt+Ctrl+ArrowLeft', 'Alt+Ctrl+KeyH'], act('moveColumnLeft')),
  ...both(['Alt+Ctrl+ArrowRight', 'Alt+Ctrl+KeyL'], act('moveColumnRight')),
  ...both(['Alt+Ctrl+ArrowDown', 'Alt+Ctrl+KeyJ'], act('moveWindowDown')),
  ...both(['Alt+Ctrl+ArrowUp', 'Alt+Ctrl+KeyK'], act('moveWindowUp')),
  ...both(['Alt+PageDown', 'Alt+KeyU'], act('focusWorkspaceDown')),
  ...both(['Alt+PageUp', 'Alt+KeyI'], act('focusWorkspaceUp')),
  ...both(
    ['Alt+Ctrl+PageDown', 'Alt+Ctrl+KeyU'],
    act('moveColumnToWorkspaceDown'),
  ),
  ...both(['Alt+Ctrl+PageUp', 'Alt+Ctrl+KeyI'], act('moveColumnToWorkspaceUp')),
  ...both(['Alt+Shift+PageDown', 'Alt+Shift+KeyU'], act('moveWorkspaceDown')),
  ['Alt+Shift+PageUp', act('moveWorkspaceUp')],
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
  ['Alt+Ctrl+KeyF', 'expand'],
]);

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

export function commandFor(event: KeyboardEvent): Command | undefined {
  const command = BINDINGS.get(chord(event));
  if (command === 'close' && event.repeat) return undefined;
  return command;
}
