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
import { agentLaunch, sessionMeta } from './agent-launch.js';
import { AgentSession, type SessionSetup } from './agent-session.js';
import { AgentSessionsStore } from './agent-sessions.store.js';

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
    @Inject(AgentSessionsStore)
    private readonly links: Pick<AgentSessionsStore, 'find' | 'save'>,
  ) {}

  async open(conversationId: string): Promise<AgentSession> {
    const cwd = sessionFolder(this.config);
    const session = new AgentSession(
      agentLaunch(this.config, {
        profile: profileDir(this.config),
        cwd,
        conversationId,
      }),
    );
    this.sessions.add(session);
    try {
      await this.start(session, conversationId, cwd);
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

  private async start(
    session: AgentSession,
    conversationId: string,
    cwd: string,
  ): Promise<void> {
    const saved = await this.links.find(conversationId);
    await session.start(this.setup(cwd), saved);
    if (!saved) await this.links.save(conversationId, session.id);
  }

  private setup(cwd: string): SessionSetup {
    return {
      cwd,
      mcpServers: [excalidrawMcpServer(this.config)],
      _meta: sessionMeta(),
    };
  }
}
