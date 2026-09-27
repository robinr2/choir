import { MessagePrimitive, useAuiState } from '@assistant-ui/react';
import { BotIcon, Volume2Icon } from 'lucide-react';
import { senderIn } from '@/conversation/transcript';
import { agentOf } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';

export function AgentMessage() {
  const sender = useAuiState((s) => senderIn(s.message.metadata.custom));
  const { view } = useWorkspace();
  const name = agentOf(view, sender.id)?.name ?? sender.name;

  return (
    <MessagePrimitive.Root
      data-slot="agent-message-root"
      data-role="agent"
      className="fade-in slide-in-from-bottom-1 animate-in flex flex-col gap-1 px-2 duration-150"
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <BotIcon className="size-3.5" aria-hidden />
        <span className="text-foreground/80 font-medium">{name}</span>
        <span className="sr-only">wrote</span>
      </div>
      <div className="border-border/70 bg-card text-card-foreground max-w-[85%] rounded-(--composer-radius) border border-l-2 border-l-sky-400/60 px-4 py-2 wrap-break-word">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

export function SpokenMark() {
  const spoken = useAuiState((s) => s.message.metadata.custom.spoken === true);
  if (!spoken) return null;
  return (
    <span
      title="Spoken aloud"
      className="text-muted-foreground me-2 inline-flex items-center"
    >
      <Volume2Icon className="size-3.5" aria-hidden />
      <span className="sr-only">Spoken aloud</span>
    </span>
  );
}
