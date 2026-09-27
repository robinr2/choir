import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { ConversationClient } from './conversation-client.js';
import {
  createApp,
  createDataDir,
  freeCanvasUrl,
  removeDataDir,
} from './create-app.js';
import { WorkspaceClient } from './workspace-client.js';

type Started = {
  app: INestApplication<App>;
  dataDir: string;
  canvasUrl: string;
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

  get canvasUrl(): string {
    return this.running().canvasUrl;
  }

  get workspace(): WorkspaceClient {
    return new WorkspaceClient(this.app);
  }

  get conversation(): ConversationClient {
    if (!this.client) throw new Error('The app has not started');
    return this.client;
  }

  async reopen(): Promise<ConversationClient> {
    const { app, dataDir, canvasUrl } = this.running();
    await app.close();
    const reopened = await createApp(dataDir, canvasUrl);
    this.started = { app: reopened, dataDir, canvasUrl };
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
    const dataDir = await createDataDir();
    const canvasUrl = await freeCanvasUrl();
    const app = await createApp(dataDir, canvasUrl);
    this.started = { app, dataDir, canvasUrl };
    this.client = new ConversationClient(app);
  }

  private async stop(): Promise<void> {
    const { app, dataDir } = this.running();
    await app.close();
    await removeDataDir(dataDir);
  }
}
