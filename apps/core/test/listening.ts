import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';

const listening = new WeakSet<INestApplication<App>>();

export async function baseUrl(app: INestApplication<App>): Promise<string> {
  if (!listening.has(app)) {
    await app.listen(0);
    listening.add(app);
  }
  return app.getUrl();
}
