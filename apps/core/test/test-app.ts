import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { ConversationClient } from './conversation-client.js';
import { createApp, createDataDir, removeDataDir } from './create-app.js';

export class TestApp {
  private started?: { app: INestApplication<App>; dataDir: string };
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

  get conversation(): ConversationClient {
    if (!this.client) throw new Error('The app has not started');
    return this.client;
  }

  async reopen(): Promise<ConversationClient> {
    const { app, dataDir } = this.running();
    await app.close();
    const reopened = await createApp(dataDir);
    this.started = { app: reopened, dataDir };
    return new ConversationClient(reopened, this.conversation.id);
  }

  private running(): { app: INestApplication<App>; dataDir: string } {
    if (!this.started) throw new Error('The app has not started');
    return this.started;
  }

  private async start(): Promise<void> {
    const dataDir = await createDataDir();
    const app = await createApp(dataDir);
    this.started = { app, dataDir };
    this.client = new ConversationClient(app);
  }

  private async stop(): Promise<void> {
    const { app, dataDir } = this.running();
    await app.close();
    await removeDataDir(dataDir);
  }
}
