import type { ComponentProps } from 'react';
import type {
  ComposerPrimitive,
  Unstable_DirectiveFormatter,
  Unstable_TriggerItem,
  Unstable_TriggerMatcher,
} from '@assistant-ui/react';
import type { Command } from '@/conversation/core-conversation';

type TriggerAdapter = NonNullable<
  ComponentProps<typeof ComposerPrimitive.Unstable_TriggerPopover>['adapter']
>;

const PICKED_IN_A_DIALOG = 'resume';

const WHITESPACE = /\s/;

function itemOf({ name, description, hint }: Command): Unstable_TriggerItem {
  return {
    id: name,
    type: 'command',
    label: `/${name}`,
    description,
    metadata: { hint, sends: hint === null || name === PICKED_IN_A_DIALOG },
  };
}

function rank({ id }: Unstable_TriggerItem, query: string): number {
  const name = id.toLowerCase();
  if (name.startsWith(query)) return 0;
  return name.includes(query) ? 1 : 2;
}

export function commandAdapter(commands: readonly Command[]): TriggerAdapter {
  const items = commands.map(itemOf);
  return {
    categories: () => [],
    categoryItems: () => [],
    search: (query) => {
      const lower = query.toLowerCase();
      return items
        .map((item) => ({ item, rank: rank(item, lower) }))
        .filter((ranked) => ranked.rank < 2)
        .toSorted((a, b) => a.rank - b.rank)
        .map(({ item }) => item);
    },
  };
}

export function sendsRightAway(item: Unstable_TriggerItem): boolean {
  return item.metadata?.sends === true;
}

export const commandFormatter: Unstable_DirectiveFormatter = {
  serialize: (item) => `/${item.id}`,
  parse: (text) => [{ kind: 'text', text }],
};

export const leadingCommand: Unstable_TriggerMatcher = (
  text,
  trigger,
  cursor,
) => {
  const query = text.slice(trigger.length, cursor);
  if (!text.startsWith(trigger) || WHITESPACE.test(query)) return null;
  return { query, offset: 0, endOffset: cursor };
};
