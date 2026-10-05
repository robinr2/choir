import type {
  AgentCatalog,
  AgentSession,
  FolderListing,
} from '@/agents/core-agents';
import type { RateLimits } from '@/agents/core-rate-limits';
import { streamOf } from './fake-event-source';

export const SESSION = 'a1b2c3d4-0000-4000-8000-000000000001';
export const OTHER_SESSION = 'b2c3d4e5-0000-4000-8000-000000000002';

export const CATALOG: AgentCatalog = {
  models: [
    {
      value: 'default',
      name: 'Default (Opus)',
      description: 'Opus for everything',
      efforts: [
        { value: 'low', name: 'Low' },
        { value: 'high', name: 'High' },
      ],
    },
    { value: 'haiku', name: 'Haiku', description: null, efforts: [] },
  ],
  modes: [
    { value: 'default', name: 'Default', description: 'Ask first' },
    { value: 'plan', name: 'Plan', description: null },
    {
      value: 'bypassPermissions',
      name: 'Bypass permissions',
      description: 'Never ask',
    },
  ],
  defaults: {
    cwd: '/home/sam/choir',
    model: 'default',
    effort: 'high',
    mode: 'bypassPermissions',
  },
};

const FOLDERS: Record<string, string[]> = {
  '/': ['app', 'bin', 'boot', 'cdrom', 'dev', 'etc', 'home', 'mnt', 'opt'],
  '/home': ['sam'],
  '/home/sam': ['choir', 'notes'],
  '/home/sam/choir': ['apps'],
  '/home/sam/notes': [],
  '/etc': ['nginx'],
};

type Agents = {
  sessions: AgentSession[];
  held: Map<string, Promise<void>>;
};

const agents: Agents = { sessions: [], held: new Map() };

export function session(change: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId: SESSION,
    cwd: '/home/sam/choir',
    title: 'Fix the login bug',
    updatedAt: '2026-10-05T09:00:00Z',
    ...change,
  };
}

export function coreHasSessions(sessions: AgentSession[]): void {
  agents.sessions = sessions;
  agents.held.clear();
}

export function coreHoldsFolder(path: string): () => void {
  const releases: (() => void)[] = [];
  agents.held.set(
    path,
    new Promise<void>((resolve) => {
      releases.push(resolve);
    }),
  );
  return () => releases.forEach((release) => release());
}

function listing(path: string): FolderListing {
  const names = FOLDERS[path] ?? [];
  const prefix = path === '/' ? '' : path;
  return {
    path,
    parent: null,
    folders: names.map((name) => ({ name, path: `${prefix}/${name}` })),
  };
}

async function folders(url: URL): Promise<FolderListing> {
  const path = url.searchParams.get('path') ?? '';
  await agents.held.get(path);
  return listing(path);
}

const READS: Record<string, (url: URL) => unknown> = {
  '/agent-catalog': () => CATALOG,
  '/agent-sessions': () => agents.sessions,
  '/folders': folders,
};

export function agentsResponse(
  path: string,
  method?: string,
): Promise<Response> | undefined {
  const url = new URL(path, 'http://choir.test');
  const read = method === 'GET' ? READS[url.pathname] : undefined;
  return read && Promise.resolve(read(url)).then((data) => Response.json(data));
}

export function coreShowsRateLimits(limits: RateLimits): void {
  streamOf('/rate-limits/events')?.receive(limits);
}
