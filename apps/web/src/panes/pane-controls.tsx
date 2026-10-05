import { useCallback } from 'react';
import { XIcon } from 'lucide-react';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import { useWorkspace } from '@/workspace/workspace-context';

export function PaneControls({ id }: Readonly<{ id: string }>) {
  const { workspace } = useWorkspace();
  const close = useCallback(() => void workspace.close(id), [workspace, id]);
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <TooltipIconButton
        tooltip="Close"
        side="bottom"
        className="size-7"
        onClick={close}
      >
        <XIcon />
      </TooltipIconButton>
    </div>
  );
}
