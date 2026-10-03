import type { IncomingMessage, ServerResponse } from 'node:http';

export const MCP_HANDLER = Symbol('McpHandler');

export const CALLER_HEADER = 'x-choir-agent';

export type McpHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  body?: unknown,
) => Promise<void>;
