import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { AgentStatus } from '@/components/assistant-ui/elements/agent-status';
import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button';
import type {
  ConversationSnapshot,
  CoreConversation,
} from '@/conversation/core-conversation';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import type { AgentView } from '@/workspace/core-workspace';
import { elapsed, shortId, shownStatus } from './agent-status';
import { PaneName } from './pane-name';

const TICK = 1000;

function tick(setNow: (now: number) => void): () => void {
  const timer = setInterval(() => setNow(Date.now()), TICK);
  return () => clearInterval(timer);
}

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => (ticking ? tick(setNow) : undefined), [ticking]);
  return now;
}

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

function SessionLabel({
  session,
}: Readonly<{ session: NonNullable<ConversationSnapshot['session']> }>) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const copy = useCallback(
    () => copyToClipboard(session.id),
    [copyToClipboard, session.id],
  );
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
      {session.title && <span className="truncate">{session.title}</span>}
      <span
        className="text-muted-foreground/70 shrink-0 font-mono"
        title={session.id}
      >
        {shortId(session.id)}
      </span>
      <TooltipIconButton
        tooltip={isCopied ? 'Copied' : 'Copy session ID'}
        className="text-muted-foreground/70 size-5 shrink-0"
        onClick={copy}
      >
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </TooltipIconButton>
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
