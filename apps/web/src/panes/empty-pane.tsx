import { type ComponentProps, type ReactElement, useCallback } from 'react';
import { BotIcon, type LucideIcon, ShapesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { OpenableKind } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';

const EXCALIDRAW_IS_OPEN = 'Excalidraw is already open in another pane';

type OpenButtonProps = {
  id: string;
  kind: OpenableKind;
  label: string;
  Icon: LucideIcon;
} & ComponentProps<typeof Button>;

function OpenButton({
  id,
  kind,
  label,
  Icon,
  ...rest
}: Readonly<OpenButtonProps>) {
  const { workspace } = useWorkspace();
  const open = useCallback(
    () => void workspace.open(id, kind),
    [workspace, id, kind],
  );
  return (
    <Button
      variant="outline"
      size="lg"
      className="h-20 w-28 flex-col gap-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-6"
      focusableWhenDisabled
      onClick={open}
      {...rest}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

function WithTooltip({
  tooltip,
  children,
}: Readonly<{ tooltip: string; children: ReactElement }>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function EmptyPane({ id }: Readonly<{ id: string }>) {
  const { view } = useWorkspace();
  const excalidrawIsOpen = view.panes.some(({ kind }) => kind === 'excalidraw');
  const excalidraw = (
    <OpenButton
      id={id}
      kind="excalidraw"
      label="Excalidraw"
      Icon={ShapesIcon}
      disabled={excalidrawIsOpen}
    />
  );
  return (
    <div className="flex h-full flex-wrap content-center items-center justify-center gap-3 overflow-auto p-4">
      <OpenButton id={id} kind="agent" label="Agent" Icon={BotIcon} />
      {excalidrawIsOpen ? (
        <WithTooltip tooltip={EXCALIDRAW_IS_OPEN}>{excalidraw}</WithTooltip>
      ) : (
        excalidraw
      )}
    </div>
  );
}
