import { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConversation } from '@/conversation/conversation-context';
import { type ChosenSession, SessionList } from './session-list';

export function ResumeDialog({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const { conversation, state } = useConversation();
  const resume = useCallback(
    ({ id }: ChosenSession) => {
      onOpenChange(false);
      void conversation.send({ text: `/resume ${id}`, images: [] });
    },
    [conversation, onOpenChange],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resume a session</DialogTitle>
          <DialogDescription>
            This pane switches to the session you choose.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-2 max-h-96 overflow-y-auto">
          {open && <SessionList hidden={state.session?.id} onChoose={resume} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
