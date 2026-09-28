import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { ConversationClient } from './conversation-client.js';
import { freeCanvasUrl } from '../src/test/free-canvas-url.js';
import {
  createApp,
  createDataDir,
  removeDataDir,
  type TestPaths,
} from './create-app.js';
import { createDatabase, dropDatabase } from './test-database.js';
import type { Mock } from 'vitest';
import type { Judge } from '../src/judge/judge.port.js';
import { WorkspaceClient } from './workspace-client.js';
import { InboxClient } from './inbox-client.js';

type Started = TestPaths & {
  app: INestApplication<App>;
  judged: Mock<Judge['judge']>;
};

export class TestApp {
  private started?: Started;
  private client?: ConversationClient;

  static use(): TestApp {
    const testApp = new TestApp();
    beforeEach(() => testApp.start());
    afterEach(() => testApp.stop());
    return testApp;
  }

  get app(): INestApplication<App> {
    return this.running().app;
  }

  get dataDir(): string {
    return this.running().dataDir;
  }

  get judged(): Mock<Judge['judge']> {
    return this.running().judged;
  }

  get canvasUrl(): string {
    return this.running().canvasUrl;
  }

  get inbox(): InboxClient {
    return new InboxClient(this.app);
  }

  get workspace(): WorkspaceClient {
    return new WorkspaceClient(this.app);
  }

  get conversation(): ConversationClient {
    if (!this.client) throw new Error('The app has not started');
    return this.client;
  }

  async reopen(): Promise<ConversationClient> {
    const { app, ...paths } = this.running();
    await app.close();
    const reopened = await createApp(paths);
    this.started = { app: reopened, ...paths };
    return new ConversationClient(reopened, this.conversation.id);
  }

  talkTo(id: string): ConversationClient {
    return new ConversationClient(this.app, id);
  }

  private running(): Started {
    if (!this.started) throw new Error('The app has not started');
    return this.started;
  }

  private async start(): Promise<void> {
    const paths = {
      dataDir: await createDataDir(),
      canvasUrl: await freeCanvasUrl(),
      databaseUrl: await createDatabase(),
    };
    const judged = vi.fn<Judge['judge']>(async () => undefined);
    const app = await createApp({ ...paths, judge: { judge: judged } });
    this.started = { app, judged, ...paths, judge: { judge: judged } };
    this.client = new ConversationClient(app);
  }

  private async stop(): Promise<void> {
    const { app, dataDir, databaseUrl } = this.running();
    await app.close();
    await removeDataDir(dataDir);
    await dropDatabase(databaseUrl);
  }
}
