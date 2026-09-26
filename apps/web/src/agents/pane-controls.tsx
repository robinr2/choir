import { type ReactNode, useCallback } from 'react';
import { Columns2Icon, Rows2Icon, XIcon } from 'lucide-react';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import type { SplitKind } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';

function PaneButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick: () => void; children: ReactNode }>) {
  return (
    <TooltipIconButton
      tooltip={label}
      side="bottom"
      className="size-7"
      onClick={onClick}
    >
      {children}
    </TooltipIconButton>
  );
}

function SplitButton({
  id,
  kind,
  label,
  children,
}: Readonly<{
  id: string;
  kind: SplitKind;
  label: string;
  children: ReactNode;
}>) {
  const { workspace } = useWorkspace();
  const split = useCallback(
    () => void workspace.split(id, kind),
    [workspace, id, kind],
  );
  return (
    <PaneButton label={label} onClick={split}>
      {children}
    </PaneButton>
  );
}

function CloseButton({ id }: Readonly<{ id: string }>) {
  const { workspace } = useWorkspace();
  const close = useCallback(() => void workspace.close(id), [workspace, id]);
  return (
    <PaneButton label="Close" onClick={close}>
      <XIcon />
    </PaneButton>
  );
}

export function PaneControls({ id }: Readonly<{ id: string }>) {
  return (
    <div className="ms-auto flex items-center gap-0.5">
      <SplitButton id={id} kind="vertical" label="Split vertically">
        <Columns2Icon />
      </SplitButton>
      <SplitButton id={id} kind="horizontal" label="Split horizontally">
        <Rows2Icon />
      </SplitButton>
      <CloseButton id={id} />
    </div>
  );
}
