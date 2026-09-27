import { useEffect, useMemo } from 'react';
import type { PipecatClient } from '@pipecat-ai/client-js';
import {
  PipecatClientAudio,
  PipecatClientProvider,
} from '@pipecat-ai/client-react';
import { LayoutGridIcon } from 'lucide-react';
import type { CoreCanvas } from '@/canvas/core-canvas';
import { PanesView } from '@/panes/panes-view';
import { VoiceSession } from '@/voice/voice-session';
import type { CoreWorkspace } from '@/workspace/core-workspace';
import { WorkspaceContext } from '@/workspace/workspace-context';

function Sidebar() {
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
    </nav>
  );
}

type AppProps = {
  client: PipecatClient;
  workspace: CoreWorkspace;
  canvas: CoreCanvas;
};

function App({ client, workspace, canvas }: Readonly<AppProps>) {
  const voice = useMemo(
    () => new VoiceSession(client, workspace),
    [client, workspace],
  );
  const context = useMemo(
    () => ({ workspace, voice, canvas }),
    [workspace, voice, canvas],
  );
  useEffect(() => voice.follow(), [voice]);

  return (
    <PipecatClientProvider client={client}>
      <WorkspaceContext value={context}>
        <div className="flex h-dvh">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <PanesView />
          </main>
        </div>
      </WorkspaceContext>
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}

export default App;
