import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CHOIR_CONFIG, type ChoirConfig } from '../choir/choir-config.js';
import { canvasServerPath } from './excalidraw.js';

const POLL_MS = 100;

type Exit = { code?: number | null };

const healthSchema = z.object({
  service: z.literal('mcp-excalidraw-canvas'),
  pid: z.number(),
});

@Injectable()
export class CanvasServer {
  private child?: ChildProcess;

  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  async start(): Promise<void> {
    const { hostname, port } = new URL(this.config.canvasUrl);
    const child = spawn(process.execPath, [canvasServerPath()], {
      env: { ...process.env, HOST: hostname, PORT: port },
      stdio: 'inherit',
    });
    this.child = child;
    const exit: Exit = {};
    child.once('exit', (code) => {
      exit.code = code;
    });
    await this.answering(child, exit);
  }

  async contents(): Promise<string> {
    const read = (path: string) =>
      fetch(`${this.config.canvasUrl}${path}`).then((response) =>
        response.text(),
      );
    const [elements, files] = await Promise.all([
      read('/api/elements'),
      read('/api/files'),
    ]);
    return `${elements}\n${files}`;
  }

  async stop(): Promise<void> {
    const { child } = this;
    if (!child || child.exitCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }

  private async answering(child: ChildProcess, exit: Exit): Promise<void> {
    if (await this.answers(child)) return;
    if (exit.code !== undefined) {
      throw new Error(
        `The Excalidraw canvas server for ${this.config.canvasUrl} exited with code ${exit.code} before it answered`,
      );
    }
    await sleep(POLL_MS);
    return this.answering(child, exit);
  }

  private answers({ pid }: ChildProcess): Promise<boolean> {
    return fetch(`${this.config.canvasUrl}/health`)
      .then((response) => response.json())
      .then(
        (health) => healthSchema.safeParse(health).data?.pid === pid,
        () => false,
      );
  }
}
