import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  type ContentBlock,
  type ListSessionsResponse,
  type NewSessionRequest,
  RequestError,
  type SessionInfo,
  type SessionUpdate,
} from '@agentclientprotocol/sdk';
import { type Config, INITIAL_CONFIG } from './mock-agent-config.js';

type SubagentNotice = {
  sessionUpdate: 'subagent_spawned' | 'subagent_state_update';
  subagentSessionId: string;
  name?: string;
  task?: string;
  state?: string;
};

export type Recorded = {
  sessionId: string;
  update: SessionUpdate | SubagentNotice;
};

export type Session = {
  updates: Recorded[];
  setup: NewSessionRequest;
  config: Config;
  prompt?: ContentBlock[];
  running?: AbortController;
  held?: () => void;
};

type Saved = Pick<Session, 'updates' | 'setup' | 'config'>;

const PAGE = 2;

export class MockSessions {
  private readonly live = new Map<string, Session>();

  constructor(private readonly dir: string) {}

  get(sessionId: string): Session {
    const session = this.live.get(sessionId);
    if (!session) throw new Error(`Unknown session ${sessionId}`);
    return session;
  }

  find(sessionId: string): Session | undefined {
    return this.live.get(sessionId);
  }

  async create(setup: NewSessionRequest): Promise<string> {
    const sessionId = randomUUID();
    this.live.set(sessionId, {
      updates: [],
      setup,
      config: INITIAL_CONFIG,
    });
    return sessionId;
  }

  async load(sessionId: string, setup: NewSessionRequest): Promise<Session> {
    const file = await readFile(this.file(sessionId), 'utf8').catch(() => {
      throw RequestError.resourceNotFound(sessionId);
    });
    const saved: Saved = JSON.parse(file);
    const session = { ...saved, setup };
    this.live.set(sessionId, session);
    return session;
  }

  async save(sessionId: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const { setup, updates, config } = this.get(sessionId);
    await writeFile(
      this.file(sessionId),
      JSON.stringify({ setup, updates, config }),
    );
  }

  async fork(sessionId: string, cwd: string): Promise<string> {
    const saved: Saved = JSON.parse(
      await readFile(this.file(sessionId), 'utf8'),
    );
    const forked = randomUUID();
    const setup = { ...saved.setup, cwd };
    const updates = saved.updates.map((notification) =>
      notification.sessionId === sessionId
        ? { ...notification, sessionId: forked }
        : notification,
    );
    await writeFile(
      this.file(forked),
      JSON.stringify({ ...saved, setup, updates }),
    );
    return forked;
  }

  close(sessionId: string): void {
    this.get(sessionId);
    this.live.delete(sessionId);
  }

  async delete(sessionId: string): Promise<void> {
    this.live.delete(sessionId);
    await rm(this.file(sessionId));
  }

  async list(cursor?: string | null): Promise<ListSessionsResponse> {
    const all = await this.saved();
    const start = Number(cursor ?? 0);
    const end = start + PAGE;
    const sessions = all.slice(start, end);
    return end < all.length
      ? { sessions, nextCursor: String(end) }
      : { sessions };
  }

  private async saved(): Promise<SessionInfo[]> {
    const files = await readdir(this.dir).catch(() => []);
    const infos = await Promise.all(files.map((file) => this.info(file)));
    return infos
      .toSorted((a, b) => b.changed - a.changed)
      .map(({ info }) => info);
  }

  private async info(
    file: string,
  ): Promise<{ info: SessionInfo; changed: number }> {
    const full = path.join(this.dir, file);
    const saved: Saved = JSON.parse(await readFile(full, 'utf8'));
    const [first] = saved.updates.flatMap(({ update }) =>
      update.sessionUpdate === 'user_message_chunk' &&
      update.content.type === 'text'
        ? [update.content.text]
        : [],
    );
    const { mtime } = await stat(full);
    const info = {
      sessionId: path.basename(file, '.json'),
      cwd: saved.setup.cwd,
      ...(first !== undefined && {
        title: first,
        updatedAt: mtime.toISOString(),
      }),
    };
    return { info, changed: mtime.getTime() };
  }

  private file(sessionId: string): string {
    return path.join(this.dir, `${sessionId}.json`);
  }
}
