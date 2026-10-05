import {
  Suspense,
  use,
  useCallback,
  useMemo,
  useReducer,
  useState,
  useTransition,
} from 'react';
import {
  type ThreadItem,
  ThreadList,
} from '@/components/assistant-ui/elements/thread-list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAgents } from './agents-context';
import type { AgentSession } from './core-agents';
import { MoreSessions, SessionSearch } from './session-search';
import { matchingRows, SESSION_PAGE, sessionRows } from './session-rows';

export type ChosenSession = ThreadItem;

type SessionListProps = Readonly<{
  hidden?: string;
  onChoose: (session: ChosenSession) => void;
  onFork?: (session: ChosenSession) => void;
  deletable?: boolean;
}>;

const LOADING = (
  <p className="text-muted-foreground px-3 py-2">Loading sessions…</p>
);

function choose(
  _doomed: ThreadItem | null,
  choice: ThreadItem | boolean | null,
): ThreadItem | null {
  return typeof choice === 'object' ? choice : null;
}

function useDeletion(onDeleted: () => void) {
  const agents = useAgents();
  const [doomed, ask] = useReducer(choose, null);
  const [, startTransition] = useTransition();
  const confirm = useCallback(
    ({ id }: ThreadItem) => {
      ask(null);
      startTransition(async () => {
        await agents.deleteSession(id);
        startTransition(onDeleted);
      });
    },
    [agents, onDeleted],
  );
  return { doomed, ask, confirm };
}

function DeleteDialog({
  doomed,
  onCancel,
  onConfirm,
}: Readonly<{
  doomed: ThreadItem;
  onCancel: (open: boolean) => void;
  onConfirm: (doomed: ThreadItem) => void;
}>) {
  const confirm = useCallback(() => onConfirm(doomed), [onConfirm, doomed]);
  return (
    <AlertDialog open onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this session?</AlertDialogTitle>
          <AlertDialogDescription>
            {doomed.title} is removed from Claude Code for good.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteConfirmation({
  deletion: { doomed, ask, confirm },
}: Readonly<{ deletion: ReturnType<typeof useDeletion> }>) {
  if (!doomed) return null;
  return <DeleteDialog doomed={doomed} onCancel={ask} onConfirm={confirm} />;
}

function useRows(listed: Promise<AgentSession[]>, hidden?: string) {
  const sessions = use(listed);
  const [now] = useState(Date.now);
  return useMemo(
    () =>
      sessionRows(
        sessions.filter(({ sessionId }) => sessionId !== hidden),
        now,
      ),
    [sessions, hidden, now],
  );
}

function usePaging(rows: readonly ThreadItem[]) {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(SESSION_PAGE);
  const matching = useMemo(() => matchingRows(rows, query), [rows, query]);
  const [more] = useState(
    () => () => setShown((count) => count + SESSION_PAGE),
  );
  return { query, setQuery, matching, shown, more };
}

type Choices = Pick<SessionListProps, 'onChoose' | 'onFork'> & {
  onDelete?: (session: ThreadItem) => void;
};

function SessionPage({
  rows,
  ...choices
}: Readonly<Choices & { rows: readonly ThreadItem[] }>) {
  const { query, setQuery, matching, shown, more } = usePaging(rows);
  return (
    <>
      <SessionSearch query={query} onSearch={setQuery} />
      <ThreadList
        aria-label="Sessions"
        threads={matching.slice(0, shown)}
        {...choices}
      />
      <MoreSessions
        matching={matching.length}
        shown={shown}
        page={SESSION_PAGE}
        onMore={more}
      />
    </>
  );
}

function Sessions({
  listed,
  onDeleted,
  hidden,
  onChoose,
  onFork,
  deletable = false,
}: SessionListProps &
  Readonly<{ listed: Promise<AgentSession[]>; onDeleted: () => void }>) {
  const deletion = useDeletion(onDeleted);
  const rows = useRows(listed, hidden);
  if (rows.length === 0) {
    return <p className="text-muted-foreground px-3 py-2">No sessions yet</p>;
  }
  return (
    <>
      <SessionPage
        rows={rows}
        onChoose={onChoose}
        onFork={onFork}
        onDelete={deletable ? deletion.ask : undefined}
      />
      <DeleteConfirmation deletion={deletion} />
    </>
  );
}

export function SessionList(props: SessionListProps) {
  const agents = useAgents();
  const [listed, setListed] = useState(() => agents.sessions());
  const reload = useCallback(() => setListed(agents.sessions()), [agents]);
  return (
    <Suspense fallback={LOADING}>
      <Sessions listed={listed} onDeleted={reload} {...props} />
    </Suspense>
  );
}
