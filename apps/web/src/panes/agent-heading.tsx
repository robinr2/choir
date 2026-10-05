import { useCallback, useSyncExternalStore } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { AgentStatus } from '@/components/assistant-ui/elements/agent-status';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import type {
  ConversationSnapshot,
  CoreConversation,
} from '@/conversation/core-conversation';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useNow } from '@/lib/use-now';
import type { AgentView } from '@/workspace/core-workspace';
import { elapsed, shortId, shownStatus } from './agent-status';
import { PaneName } from './pane-name';

function StatusPill({
  status,
}: Readonly<{ status: ConversationSnapshot['status'] }>) {
  const shown = shownStatus(status.state);
  const now = useNow(shown.ticks);
  return (
    <AgentStatus
      state={shown.state}
      label={shown.label}
      elapsed={shown.ticks ? elapsed(status.since, now) : undefined}
      trailing={null}
      className="shrink-0 gap-1.5 py-0.5 ps-2.5 pe-2.5"
    />
  );
}

function CopyId({ id }: Readonly<{ id: string }>) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const copy = useCallback(() => copyToClipboard(id), [copyToClipboard, id]);
  return (
    <TooltipIconButton
      tooltip={isCopied ? 'Copied' : 'Copy session ID'}
      className="text-muted-foreground/70 size-5 shrink-0"
      onClick={copy}
    >
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </TooltipIconButton>
  );
}

function SessionLabel({
  session,
}: Readonly<{ session: NonNullable<ConversationSnapshot['session']> }>) {
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
      {session.title && (
        <span className="min-w-0 truncate" title={session.title}>
          {session.title}
        </span>
      )}
      <span
        className="text-muted-foreground/70 hidden shrink-0 font-mono @md:inline"
        title={session.id}
      >
        {shortId(session.id)}
      </span>
      <CopyId id={session.id} />
    </div>
  );
}

export function AgentHeading({
  pane,
  conversation,
  isVoice,
}: Readonly<{
  pane: AgentView;
  conversation: CoreConversation;
  isVoice: boolean;
}>) {
  const { session, status } = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );
  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <PaneName id={pane.id} name={pane.name} />
        {session && <SessionLabel session={session} />}
      </div>
      <StatusPill key={status.since} status={status} />
      {isVoice && (
        <output
          aria-label="Voice is on"
          className="bg-active size-1.5 shrink-0 rounded-full"
        />
      )}
    </>
  );
}
