import { type ComponentProps, type ReactElement, useCallback } from 'react';
import { BotIcon, type LucideIcon, ShapesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWorkspace } from '@/workspace/workspace-context';

const EXCALIDRAW_IS_OPEN = 'Excalidraw is already open in another pane';

type OpenButtonProps = {
  label: string;
  Icon: LucideIcon;
} & ComponentProps<typeof Button>;

function OpenButton({ label, Icon, ...rest }: Readonly<OpenButtonProps>) {
  return (
    <Button
      variant="outline"
      size="lg"
      className="h-20 w-28 flex-col gap-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-6"
      focusableWhenDisabled
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

export function EmptyPane({
  id,
  onAgent,
}: Readonly<{ id: string; onAgent: () => void }>) {
  const { workspace, view } = useWorkspace();
  const openCanvas = useCallback(
    () => void workspace.openCanvas(id),
    [workspace, id],
  );
  const excalidrawIsOpen = view.panes.some(({ kind }) => kind === 'excalidraw');
  const excalidraw = (
    <OpenButton
      label="Excalidraw"
      Icon={ShapesIcon}
      disabled={excalidrawIsOpen}
      onClick={openCanvas}
    />
  );
  return (
    <div className="flex h-full flex-wrap content-center items-center justify-center gap-3 overflow-auto p-4">
      <OpenButton label="Agent" Icon={BotIcon} onClick={onAgent} />
      {excalidrawIsOpen ? (
        <WithTooltip tooltip={EXCALIDRAW_IS_OPEN}>{excalidraw}</WithTooltip>
      ) : (
        excalidraw
      )}
    </div>
  );
}
