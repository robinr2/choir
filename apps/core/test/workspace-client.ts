import { INestApplication } from '@nestjs/common';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { z } from 'zod';
import type { WorkspaceView } from '../src/workspace/workspace.port.js';
import { baseUrl } from './listening.js';

export type ToolReply = { text: string; isError: boolean };

const contentSchema = z.array(z.object({ text: z.string() }));

export class WorkspaceClient {
  constructor(private readonly app: INestApplication<App>) {}

  async view(): Promise<WorkspaceView> {
    const response = await request(this.app.getHttpServer())
      .get('/workspace')
      .expect(200);
    return response.body;
  }

  async agentIds(): Promise<string[]> {
    return (await this.view()).panes.flatMap((pane) =>
      pane.kind === 'agent' ? [pane.id] : [],
    );
  }

  async firstAgent(): Promise<string> {
    const [id] = await this.agentIds();
    if (!id) throw new Error('The workspace has no agent');
    return id;
  }

  send(method: 'post' | 'put' | 'patch' | 'delete', path: string, body = {}) {
    const server = request(this.app.getHttpServer());
    return server[method](`/workspace/${path}`).send(body);
  }

  async tools(agentId: string): Promise<Client> {
    const client = new Client({ name: 'choir-test', version: '1.0.0' });
    const url = new URL('/mcp', await baseUrl(this.app));
    await client.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { 'X-Choir-Agent': agentId } },
      }),
    );
    return client;
  }
}

export async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolReply> {
  const result = await client.callTool({ name, arguments: args });
  const [first] = contentSchema.parse(result.content);
  return { text: first?.text ?? '', isError: result.isError === true };
}

export async function callForJson<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { text, isError } = await call(client, name, args);
  if (isError) throw new Error(text);
  return JSON.parse(text);
}
