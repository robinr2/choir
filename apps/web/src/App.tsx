import { useEffect, useMemo, useReducer } from 'react';
import type { PipecatClient } from '@pipecat-ai/client-js';
import {
  PipecatClientAudio,
  PipecatClientProvider,
} from '@pipecat-ai/client-react';
import { LayoutGridIcon } from 'lucide-react';
import type { CoreCanvas } from '@/canvas/core-canvas';
import type { CoreInbox } from '@/inbox/core-inbox';
import { InboxButton } from '@/inbox/inbox-button';
import { InboxContext } from '@/inbox/inbox-context';
import { InboxPanel } from '@/inbox/inbox-panel';
import { NotificationList } from '@/inbox/notification-list';
import { TodoList } from '@/inbox/todo-list';
import { Strip } from '@/strip/strip';
import { StripContext } from '@/strip/strip-context';
import { ViewStore } from '@/strip/view-store';
import { VoiceSession } from '@/voice/voice-session';
import type { CoreWorkspace } from '@/workspace/core-workspace';
import { WorkspaceContext } from '@/workspace/workspace-context';

function Sidebar({
  inboxOpen,
  toggleInbox,
}: Readonly<{ inboxOpen: boolean; toggleInbox: () => void }>) {
  return (
    <nav
      aria-label="Views"
      className="bg-sidebar text-sidebar-foreground border-sidebar-border flex w-14 shrink-0 flex-col items-center gap-2 border-r py-3"
    >
      <span className="text-sm font-semibold tracking-tight">choir</span>
      <a
        href="/"
        aria-current="page"
        title="Agents"
        className="bg-sidebar-accent text-sidebar-accent-foreground flex size-9 items-center justify-center rounded-md"
      >
        <LayoutGridIcon className="size-4" aria-hidden />
        <span className="sr-only">Agents</span>
      </a>
      <InboxButton open={inboxOpen} onToggle={toggleInbox} />
    </nav>
  );
}

const INBOX_LISTS = {
  todos: <TodoList />,
  notifications: <NotificationList />,
};

type AppProps = {
  client: PipecatClient;
  workspace: CoreWorkspace;
  canvas: CoreCanvas;
  inbox: CoreInbox;
};

function flip(open: boolean): boolean {
  return !open;
}

function Screen() {
  const [inboxOpen, toggleInbox] = useReducer(flip, false);
  return (
    <div className="flex h-dvh">
      <Sidebar inboxOpen={inboxOpen} toggleInbox={toggleInbox} />
      <main className="min-w-0 flex-1 overflow-clip">
        <Strip />
      </main>
      {inboxOpen && <InboxPanel lists={INBOX_LISTS} />}
    </div>
  );
}

function App({ client, workspace, canvas, inbox }: Readonly<AppProps>) {
  const voice = useMemo(
    () => new VoiceSession(client, workspace),
    [client, workspace],
  );
  const context = useMemo(
    () => ({ workspace, voice, canvas }),
    [workspace, voice, canvas],
  );
  const strip = useMemo(() => new ViewStore(workspace), [workspace]);
  useEffect(() => voice.follow(), [voice]);

  return (
    <PipecatClientProvider client={client}>
      <WorkspaceContext value={context}>
        <StripContext value={strip}>
          <InboxContext value={inbox}>
            <Screen />
          </InboxContext>
        </StripContext>
      </WorkspaceContext>
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}

export default App;
