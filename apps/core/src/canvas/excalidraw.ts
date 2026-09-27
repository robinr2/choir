import { fileURLToPath } from 'node:url';
import type { ChoirConfig } from '../choir/choir-config.js';

export function canvasServerPath(): string {
  return fileURLToPath(
    import.meta.resolve('mcp-excalidraw-server/dist/server.js'),
  );
}

export function excalidrawMcpPath(): string {
  return fileURLToPath(import.meta.resolve('mcp-excalidraw-server'));
}

export function excalidrawMcpEnvironment(
  config: ChoirConfig,
): Record<string, string> {
  return {
    EXPRESS_SERVER_URL: config.canvasUrl,
    EXCALIDRAW_NO_AUTOSTART: '1',
  };
}
