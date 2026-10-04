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
  type ClaudeOptions,
  claudeOptions,
  type Launch,
  newSessionLink,
  sessionLink,
} from './agent-links.js';
import { AgentLinksStore } from './agent-links.store.js';
import { AgentSession, type SessionSetup } from './agent-session.js';

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
  private readonly sessions = new Set<AgentSession>();

  constructor(
    @Inject(CHOIR_CONFIG) private readonly config: ChoirConfig,
    @Inject(AgentLinksStore)
    private readonly links: Pick<AgentLinksStore, 'find' | 'save'>,
    @Inject(AgentCatalogService)
    private readonly catalog: Pick<AgentCatalogService, 'fork'>,
  ) {}

  async launch(conversationId: string, launch: Launch): Promise<void> {
    if (!('resume' in launch)) {
      await this.links.save(newSessionLink(conversationId, launch));
      return;
    }
    const { resume, cwd, fork } = launch;
    const sessionId = fork ? await this.catalog.fork(resume, cwd) : resume;
    await this.link(conversationId, sessionId, cwd);
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
    const session = new AgentSession(
      agentLaunch(this.config, {
        profile: profileDir(this.config),
        cwd: link.cwd,
        conversationId,
      }),
    );
    this.sessions.add(session);
    try {
      await this.start(session, link);
    } catch (error) {
      await this.close(session);
      throw error;
    }
    return session;
  }

  async close(session: AgentSession): Promise<void> {
    this.sessions.delete(session);
    await session.close();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await Promise.all([...this.sessions].map((session) => this.close(session)));
  }

  private async start(session: AgentSession, link: AgentLink): Promise<void> {
    const { sessionId, cwd, mode } = link;
    if (sessionId !== null) {
      await session.start(this.setup(cwd), { sessionId });
      return;
    }
    await session.start(this.setup(cwd, claudeOptions(link)), {
      ...(mode !== null && { mode }),
    });
    await this.links.save({ ...link, sessionId: session.id });
  }

  private setup(cwd: string, options: ClaudeOptions = {}): SessionSetup {
    return {
      cwd,
      mcpServers: [excalidrawMcpServer(this.config)],
      _meta: sessionMeta(options),
    };
  }
}
