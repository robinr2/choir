import { useMemo } from 'react';
import { useAui } from '@assistant-ui/react';
import { SquareSlashIcon } from 'lucide-react';
import { ComposerTriggerPopover } from '@/components/assistant-ui/elements/composer-trigger-popover.aui';
import { useConversation } from '@/conversation/conversation-context';
import {
  commandAdapter,
  commandFormatter,
  leadingCommand,
  sendsRightAway,
} from './slash-command-items';

export function SlashCommands() {
  const aui = useAui();
  const { state } = useConversation();
  const adapter = useMemo(
    () => commandAdapter(state.commands),
    [state.commands],
  );
  const directive = useMemo(
    () => ({
      formatter: commandFormatter,
      onInserted: (item: Parameters<typeof sendsRightAway>[0]) => {
        if (sendsRightAway(item)) aui.composer().send({ steer: false });
      },
    }),
    [aui],
  );
  return (
    <ComposerTriggerPopover
      char="/"
      adapter={adapter}
      matcher={leadingCommand}
      directive={directive}
      fallbackIcon={SquareSlashIcon}
      emptyItemsLabel="No matching commands"
      className="max-h-80 w-full max-w-md overflow-y-auto"
    />
  );
}
