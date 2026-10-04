import { z } from 'zod';
import { AgentProcess } from './agent-process.js';

const readySchema = z.object({ params: z.object({ pid: z.number() }) });

const STUBBORN = `
process.on('SIGTERM', () => {});
process.stdout.write('{"jsonrpc":"2.0","method":"ready"}\\n');
setInterval(() => {}, 1000);
`;

const PARENT = `
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method: 'ready', params: { pid: child.pid } }) + '\\n');
setInterval(() => {}, 1000);
`;

function started(script: string) {
  const agent = new AgentProcess({
    command: [process.execPath, '-e', script],
    cwd: process.cwd(),
    env: {},
  });
  const reader = agent.stream.readable.getReader();
  return { agent, reader, ready: reader.read() };
}

function alive(pid: number): boolean {
  try {
    return process.kill(pid, 0);
  } catch {
    return false;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

it('stops the agent and every process it started', async () => {
  const { agent, reader, ready } = started(PARENT);
  const { value } = await ready;
  const { pid } = readySchema.parse(value).params;
  expect(alive(pid)).toBe(true);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await agent.stop();
  expect(vi.getTimerCount()).toBe(0);
  expect((await reader.read()).done).toBe(true);
  await vi.waitFor(() => expect(alive(pid)).toBe(false));
});

it('kills an agent that does not stop when asked', async () => {
  const { agent, reader, ready } = started(STUBBORN);
  expect((await ready).value).toMatchObject({ method: 'ready' });
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const stopped = agent.stop();
  vi.advanceTimersByTime(5_000);
  await stopped;
  expect((await reader.read()).done).toBe(true);
  await expect(agent.stop()).resolves.toBeUndefined();
});

it('stops an agent that never started', async () => {
  const agent = new AgentProcess({
    command: ['/nonexistent/agent'],
    cwd: process.cwd(),
    env: {},
  });
  await expect(agent.stop()).resolves.toBeUndefined();
});

it('refuses to start without a command', () => {
  expect(
    () => new AgentProcess({ command: [], cwd: process.cwd(), env: {} }),
  ).toThrow("The argument 'file' cannot be empty");
});
