import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { methods } from '@agentclientprotocol/sdk';
import { mockAgentCommand } from '../test/mock-agent-command.js';
import { AgentConnection } from './agent-connection.js';

vi.setConfig({ testTimeout: 60_000 });

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'choir-connection-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it('declines what the agent asks and ignores what it tells when nobody listens', async () => {
  const sessions = path.join(dir, 'sessions');
  const connection = new AgentConnection({
    command: mockAgentCommand(sessions),
    cwd: dir,
    env: {},
  });
  await connection.initialize();
  const { agent } = connection;
  const { sessionId } = await agent.request(methods.agent.session.new, {
    cwd: dir,
    mcpServers: [],
  });
  const prompt = (text: string) =>
    agent.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: 'text', text }],
    });
  await prompt('ask-permission allow_once');
  await prompt('elicit url');
  const saved = JSON.parse(
    await readFile(path.join(sessions, `${sessionId}.json`), 'utf8'),
  );
  expect(
    saved.updates.flatMap(({ update }: { update: { content?: object } }) =>
      update.content ? [update.content] : [],
    ),
  ).toEqual([
    { type: 'text', text: 'ask-permission allow_once' },
    { type: 'text', text: '{"outcome":"cancelled"}' },
    { type: 'text', text: 'elicit url' },
    { type: 'text', text: '{"action":"decline"}' },
  ]);
  await connection.close();
  await connection.closed;
});
