import { Inject, Injectable } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { z } from 'zod';
import {
  CHOIR,
  CHOIR_CONFIG,
  type ChoirConfig,
} from '../choir/choir-config.js';
import { excalidrawMcpEnvironment, excalidrawMcpPath } from './excalidraw.js';

const sceneSchema = z.object({ elements: z.array(z.unknown()) });

const resultSchema = z.object({
  content: z.tuple([z.object({ type: z.literal('text'), text: z.string() })]),
  isError: z.boolean().optional(),
});

@Injectable()
export class ExcalidrawScene {
  private readonly client = new Client(CHOIR);

  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async connect(): Promise<void> {
    await this.client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [excalidrawMcpPath()],
        env: excalidrawMcpEnvironment(this.config),
      }),
    );
  }

  export(): Promise<string> {
    return this.call('export_scene', {});
  }

  async import(scene: string): Promise<void> {
    const { elements } = sceneSchema.parse(JSON.parse(scene));
    if (elements.length === 0) {
      await this.call('clear_canvas', {});
      return;
    }
    await this.call('import_scene', { data: scene, mode: 'replace' });
  }

  close(): Promise<void> {
    return this.client.close();
  }

  private async call(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const result = await this.client.callTool({ name, arguments: args });
    const {
      content: [{ text }],
      isError,
    } = resultSchema.parse(result);
    if (isError) throw new Error(text);
    return text;
  }
}
