import { createServer } from 'node:net';

export function freeCanvasUrl(): Promise<string> {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address?.port;
      server.close(() => resolve(`http://127.0.0.1:${port}`));
    });
  });
}
