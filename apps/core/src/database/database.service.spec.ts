import { DatabaseService } from './database.service.js';

it('closes its connections when the app shuts down', async () => {
  const database = new DatabaseService({
    dataDir: '/data',
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  });
  const close = vi.spyOn(database.client, 'close');
  await database.onApplicationShutdown();
  expect(close).toHaveBeenCalledOnce();
});
