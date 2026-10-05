import { type KeyboardEvent, useMemo } from 'react';
import { useAui } from '@assistant-ui/react';

function steers(event: KeyboardEvent): boolean {
  return (
    event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey
  );
}

export function useComposerKeys() {
  const aui = useAui();
  return useMemo(
    () => ({
      onSubmit: () => {
        aui.composer().send({ steer: false });
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (!steers(event)) return;
        const composer = aui.composer();
        const { canSend, queue } = composer.getState();
        if (canSend) composer.send({ steer: true });
        else if (queue.length > 0) {
          composer
            .queueItem({ index: 0 })
            .move({ lane: 'steer', insertAfter: null });
        }
      },
    }),
    [aui],
  );
}
