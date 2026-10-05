import { Suspense, use, useCallback, useState } from 'react';
import { ArrowLeftIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Launch } from '@/workspace/core-workspace';
import { useWorkspace } from '@/workspace/workspace-context';
import { AgentSettings, type ChosenSettings } from './agent-settings';
import { useAgents } from './agents-context';
import { FolderTree } from './folder-tree';
import { launchOf } from './launch-settings';
import { type ChosenSession, SessionList } from './session-list';

const LOADING = <p className="text-muted-foreground text-sm">Loading…</p>;

function Heading({ children }: Readonly<{ children: string }>) {
  return (
    <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {children}
    </h3>
  );
}

function useLaunch(paneId: string) {
  const { workspace } = useWorkspace();
  return useCallback(
    (launch: Launch) => void workspace.launch(paneId, launch),
    [workspace, paneId],
  );
}

function useChosen(defaults: ChosenSettings) {
  const [chosen, setChosen] = useState(defaults);
  const [handlers] = useState(() => ({
    onModel: (model: string) => setChosen((now) => ({ ...now, model })),
    onEffort: (effort: string) => setChosen((now) => ({ ...now, effort })),
    onMode: (mode: string) => setChosen((now) => ({ ...now, mode })),
  }));
  return { chosen, handlers };
}

function FolderPicker({
  cwd,
  onPick,
}: Readonly<{ cwd: string; onPick: (cwd: string) => void }>) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <Heading>Folder</Heading>
        <span className="text-muted-foreground font-mono text-xs break-all">
          {cwd}
        </span>
      </div>
      <FolderTree selected={cwd} onSelect={onPick} />
    </>
  );
}

function NewSession({ paneId }: Readonly<{ paneId: string }>) {
  const launch = useLaunch(paneId);
  const catalog = use(useAgents().catalog());
  const [cwd, setCwd] = useState(catalog.defaults.cwd);
  const { chosen, handlers } = useChosen(catalog.defaults);
  const start = useCallback(
    () => launch(launchOf(cwd, chosen, catalog.models)),
    [launch, cwd, chosen, catalog.models],
  );
  return (
    <section aria-label="New session" className="flex flex-col gap-2">
      <FolderPicker cwd={cwd} onPick={setCwd} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AgentSettings
          models={catalog.models}
          modes={catalog.modes}
          chosen={chosen}
          {...handlers}
        />
        <Button onClick={start}>
          <PlayIcon aria-hidden />
          Start
        </Button>
      </div>
    </section>
  );
}

function ResumeSessions({ paneId }: Readonly<{ paneId: string }>) {
  const launch = useLaunch(paneId);
  const resume = useCallback(
    ({ id, folder }: ChosenSession) => launch({ resume: id, cwd: folder }),
    [launch],
  );
  const fork = useCallback(
    ({ id, folder }: ChosenSession) =>
      launch({ resume: id, cwd: folder, fork: true }),
    [launch],
  );
  return (
    <section aria-label="Resume" className="flex min-h-0 flex-col gap-2">
      <Heading>Resume a session</Heading>
      <div className="-mx-3 min-h-0">
        <SessionList deletable onChoose={resume} onFork={fork} />
      </div>
    </section>
  );
}

export function LaunchForm({
  paneId,
  onCancel,
}: Readonly<{ paneId: string; onCancel: () => void }>) {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          onClick={onCancel}
        >
          <ArrowLeftIcon />
        </Button>
        <h2 className="text-base font-medium">New agent</h2>
      </div>
      <Suspense fallback={LOADING}>
        <NewSession paneId={paneId} />
      </Suspense>
      <Separator />
      <ResumeSessions paneId={paneId} />
    </div>
  );
}
