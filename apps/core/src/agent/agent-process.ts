import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { once } from 'node:events';
import { type Readable, Writable } from 'node:stream';
import { ndJsonStream, type Stream } from '@agentclientprotocol/sdk';

export type AgentLaunch = {
  command: string[];
  cwd: string;
  env: Record<string, string>;
};

const STOP_TIMEOUT = 5_000;

type Child = ChildProcessByStdio<Writable, Readable, null>;

export function readableStream(readable: Readable): ReadableStream<Uint8Array> {
  const chunks: AsyncIterator<Uint8Array> = readable[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await chunks.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
  });
}

export class AgentProcess {
  readonly stream: Stream;
  private readonly child: Child;
  private readonly exited: Promise<unknown>;

  constructor({ command: [file = '', ...args], cwd, env }: AgentLaunch) {
    this.child = spawn(file, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'ignore'],
      detached: true,
    });
    this.exited = once(this.child, 'exit').catch(() => undefined);
    this.stream = ndJsonStream(
      Writable.toWeb(this.child.stdin),
      readableStream(this.child.stdout),
    );
  }

  async stop(): Promise<void> {
    this.signal('SIGTERM');
    const timer = setTimeout(() => this.signal('SIGKILL'), STOP_TIMEOUT);
    await this.exited;
    clearTimeout(timer);
  }

  private signal(signal: NodeJS.Signals): void {
    try {
      process.kill(-Number(this.child.pid), signal);
    } catch {}
  }
}
