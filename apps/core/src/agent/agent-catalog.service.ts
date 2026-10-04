import { randomUUID } from 'node:crypto';
import {
  type ClientContext,
  methods,
  type SessionInfo,
} from '@agentclientprotocol/sdk';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  profileDir,
  sessionFolder,
} from '../choir/choir-config.js';
import {
  type AgentCatalog,
  type CatalogEffort,
  catalogOf,
  choices,
  efforts,
  listing,
  MODEL,
  type SessionListing,
} from './agent-catalog.js';
import { AgentConnection } from './agent-connection.js';
import { agentLaunch, sessionMeta } from './agent-launch.js';

function sequentially<Item, Result>(
  items: Item[],
  each: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  return items.reduce<Promise<Result[]>>(
    async (done, item) => [...(await done), await each(item)],
    Promise.resolve([]),
  );
}

async function listed(
  agent: ClientContext,
  cursor?: string,
): Promise<SessionInfo[]> {
  const { sessions, nextCursor } = await agent.request(
    methods.agent.session.list,
    { cursor },
  );
  if (!nextCursor) return sessions;
  return [...sessions, ...(await listed(agent, nextCursor))];
}

@Injectable()
export class AgentCatalogService implements BeforeApplicationShutdown {
  private helper?: Promise<AgentConnection>;
  private cached?: Promise<AgentCatalog>;

  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  catalog(): Promise<AgentCatalog> {
    this.cached ??= this.probe().catch((error: unknown) => {
      this.cached = undefined;
      throw error;
    });
    return this.cached;
  }

  async sessions(): Promise<SessionListing[]> {
    const { agent } = await this.connection();
    return (await listed(agent)).map(listing);
  }

  async delete(sessionId: string): Promise<void> {
    const { agent } = await this.connection();
    await agent.request(methods.agent.session.delete, { sessionId });
  }

  async fork(sessionId: string, cwd: string): Promise<string> {
    const { agent } = await this.connection();
    const forked = await agent.request(methods.agent.session.fork, {
      sessionId,
      cwd,
      mcpServers: [],
    });
    return forked.sessionId;
  }

  async beforeApplicationShutdown(): Promise<void> {
    const { helper } = this;
    if (helper) await (await helper).close();
  }

  private connection(): Promise<AgentConnection> {
    this.helper ??= this.spawn();
    return this.helper;
  }

  private async spawn(): Promise<AgentConnection> {
    const helper = new AgentConnection(
      agentLaunch(this.config, {
        profile: profileDir(this.config),
        cwd: sessionFolder(this.config),
        conversationId: randomUUID(),
      }),
    );
    void helper.closed.then(() => {
      this.helper = undefined;
    });
    await helper.initialize();
    return helper;
  }

  private async probe(): Promise<AgentCatalog> {
    const { agent } = await this.connection();
    const cwd = sessionFolder(this.config);
    const { sessionId, configOptions } = await agent.request(
      methods.agent.session.new,
      { cwd, mcpServers: [], _meta: sessionMeta() },
    );
    const options = configOptions ?? [];
    const modelEfforts = await sequentially(choices(options, MODEL), (model) =>
      this.effortsOf(agent, sessionId, model.value),
    );
    await agent.request(methods.agent.session.close, { sessionId });
    return catalogOf(options, modelEfforts, cwd);
  }

  private async effortsOf(
    agent: ClientContext,
    sessionId: string,
    value: string,
  ): Promise<CatalogEffort[]> {
    const { configOptions } = await agent.request(
      methods.agent.session.setConfigOption,
      { sessionId, configId: MODEL, value },
    );
    return efforts(configOptions);
  }
}
