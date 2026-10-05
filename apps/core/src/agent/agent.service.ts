import { RequestError } from '@agentclientprotocol/sdk';
import {
  Inject,
  Injectable,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  profileDir,
  sessionFolder,
} from '../choir/choir-config.js';
import {
  excalidrawMcpEnvironment,
  excalidrawMcpPath,
} from '../canvas/excalidraw.js';
import { AgentCatalogService } from './agent-catalog.service.js';
import { agentLaunch, sessionMeta } from './agent-launch.js';
import {
  type AgentLink,
  type Launch,
  newSessionLink,
  sessionLink,
  sessionSettings,
} from './agent-links.js';
import { AgentLinksStore } from './agent-links.store.js';
import { AgentSession, type SessionSetup } from './agent-session.js';

type Closable = { close(): Promise<void> };

function unsaved(error: unknown): boolean {
  return (
    error instanceof RequestError &&
    error.code === RequestError.resourceNotFound().code
  );
}

function excalidrawMcpServer(config: ChoirConfig) {
  return {
    name: 'excalidraw',
    command: process.execPath,
    args: [excalidrawMcpPath()],
    env: Object.entries(excalidrawMcpEnvironment(config)).map(
      ([name, value]) => ({ name, value }),
    ),
  };
}

@Injectable()
export class AgentService implements BeforeApplicationShutdown {
  private readonly opened = new Set<Closable>();

  constructor(
    @Inject(CHOIR_CONFIG) private readonly config: ChoirConfig,
    @Inject(AgentLinksStore)
    private readonly links: Pick<AgentLinksStore, 'find' | 'save'>,
    @Inject(AgentCatalogService)
    private readonly agentCatalog: Pick<
      AgentCatalogService,
      'catalog' | 'sessions' | 'fork'
    >,
  ) {}

  async launch(conversationId: string, launch: Launch): Promise<void> {
    if (!('resume' in launch)) {
      await this.links.save(newSessionLink(conversationId, launch));
      return;
    }
    const { resume, cwd, fork } = launch;
    const sessionId = fork ? await this.fork(resume, cwd) : resume;
    await this.link(conversationId, sessionId, cwd);
  }

  catalog() {
    return this.agentCatalog.catalog();
  }

  sessions() {
    return this.agentCatalog.sessions();
  }

  fork(sessionId: string, cwd: string): Promise<string> {
    return this.agentCatalog.fork(sessionId, cwd);
  }

  async link(
    conversationId: string,
    sessionId: string,
    cwd: string,
  ): Promise<void> {
    await this.links.save(sessionLink(conversationId, sessionId, cwd));
  }

  async open(conversationId: string): Promise<AgentSession> {
    const link =
      (await this.links.find(conversationId)) ??
      newSessionLink(conversationId, { cwd: sessionFolder(this.config) });
    try {
      return await this.started(link);
    } catch (error) {
      if (!unsaved(error)) throw error;
      return this.started({ ...link, sessionId: null });
    }
  }

  private async started(link: AgentLink): Promise<AgentSession> {
    const { conversationId, cwd } = link;
    const session = new AgentSession(
      agentLaunch(this.config, {
        profile: profileDir(this.config),
        cwd,
        conversationId,
      }),
    );
    this.opened.add(session);
    try {
      await this.start(session, link);
    } catch (error) {
      await this.close(session);
      throw error;
    }
    return session;
  }

  async close(session: Closable): Promise<void> {
    this.opened.delete(session);
    await session.close();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await Promise.all([...this.opened].map((session) => this.close(session)));
  }

  private async start(session: AgentSession, link: AgentLink): Promise<void> {
    const { sessionId, cwd } = link;
    if (sessionId !== null) {
      await session.start(this.setup(cwd), { sessionId });
      return;
    }
    await session.start(this.setup(cwd), sessionSettings(link));
    await this.links.save({ ...link, sessionId: session.id });
  }

  private setup(cwd: string): SessionSetup {
    return {
      cwd,
      mcpServers: [excalidrawMcpServer(this.config)],
      _meta: sessionMeta(),
    };
  }
}
