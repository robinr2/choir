import request from 'supertest';
import { TestApp } from './test-app.js';
import { call, callForJson } from './workspace-client.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

type Created = { id: string; name: string };

const testApp = TestApp.use();

async function toolsOfFirstAgent() {
  const id = await testApp.workspace.firstAgent();
  return { id, tools: await testApp.workspace.tools(id) };
}

it('gives every agent the orchestration tools', async () => {
  const { tools } = await toolsOfFirstAgent();
  const { tools: listed } = await tools.listTools();
  expect(listed.map(({ name }) => name).slice(0, 4)).toEqual([
    'open_agent',
    'send_message',
    'close_agent',
    'list_agents',
  ]);
  expect(listed.every(({ description = '' }) => description.length > 30)).toBe(
    true,
  );
  expect(tools.getServerVersion()).toMatchObject({
    name: 'choir',
    version: '1.0.0',
  });
  expect(tools.getInstructions()).toMatch(/new agent.*with open_agent/);
  await tools.close();
});

it('opens agents as new columns right after the focused column and focuses them', async () => {
  const { id, tools } = await toolsOfFirstAgent();
  const second = await callForJson<Created>(tools, 'open_agent', {});
  const third = await callForJson<Created>(tools, 'open_agent', {
    name: 'tester',
  });
  expect([second.name, third.name]).toEqual(['agent 2', 'tester']);
  const view = await testApp.workspace.view();
  const [first, empty] = view.workspaces;
  expect(empty.columns).toEqual([]);
  expect(view.activeWorkspace).toBe(0);
  expect(first.activeColumn).toBe(2);
  expect(first.restoresPrevious).toBe(true);
  expect(
    first.columns.map(({ width, fullWidth, tiles }) => ({
      width,
      fullWidth,
      tiles,
    })),
  ).toEqual(
    [id, second.id, third.id].map((paneId) => ({
      width: 0.5,
      fullWidth: false,
      tiles: [{ paneId, height: { auto: 1 } }],
    })),
  );
  await tools.close();
});

it('lists the agents, which of them is calling, the other panes and the layout', async () => {
  const { id, tools } = await toolsOfFirstAgent();
  const other = await callForJson<Created>(tools, 'open_agent', {
    name: 'writer',
  });
  const canvas = (await testApp.workspace.send('post', 'panes').expect(201))
    .body.id;
  await testApp.workspace
    .send('put', `panes/${canvas}/content`, { kind: 'excalidraw' })
    .expect(200);
  const conversation = testApp.talkTo(other.id);
  const running = conversation.say('stream-sleep 1000 drafting');
  await conversation.waitForAnswer('drafting');
  expect(await callForJson(tools, 'list_agents')).toEqual({
    agents: [
      { id, name: 'agent 1', status: 'idle', you: true },
      { id: other.id, name: 'writer', status: 'working', you: false },
    ],
    otherPanes: [{ id: canvas, kind: 'excalidraw' }],
    layout: {
      workspaces: (await testApp.workspace.view()).workspaces,
      activeWorkspace: 0,
    },
  });
  await running;
  await tools.close();
});

it('closes agents', async () => {
  const { tools } = await toolsOfFirstAgent();
  const other = await callForJson<Created>(tools, 'open_agent', {});
  expect(
    await callForJson(tools, 'close_agent', { agentId: other.id }),
  ).toEqual({ closed: true });
  expect(await testApp.workspace.agentIds()).toHaveLength(1);
  expect(await call(tools, 'close_agent', { agentId: UNKNOWN })).toEqual({
    text: expect.stringContaining(`There is no pane ${UNKNOWN}`),
    isError: true,
  });
  await tools.close();
});

it('delivers a message into the chat of another agent, from the sender', async () => {
  const { id, tools } = await toolsOfFirstAgent();
  const other = await callForJson<Created>(tools, 'open_agent', {});
  expect(
    await callForJson(tools, 'send_message', {
      agentId: other.id,
      text: 'echo hello',
    }),
  ).toEqual({ sent: true });
  const prompt = `(A message from the agent "agent 1", ID ${id}. Answer it with the send_message tool of the choir MCP server. It sees nothing else you write.)\n\necho hello`;
  const conversation = testApp.talkTo(other.id);
  await conversation.waitForAnswer(`unrecognized prompt: ${prompt}`);
  const from = { id, name: 'agent 1' };
  expect(await conversation.messages()).toEqual([
    {
      id: 'm0',
      role: 'user',
      parts: [{ type: 'text', text: 'echo hello' }],
      from,
    },
    {
      id: 'm1',
      role: 'assistant',
      parts: [{ type: 'text', text: `unrecognized prompt: ${prompt}` }],
    },
  ]);
  const reopened = await testApp.reopen();
  expect((await testApp.talkTo(other.id).messages())[0]).toEqual({
    id: 'm0',
    role: 'user',
    parts: [{ type: 'text', text: 'echo hello' }],
    from,
  });
  expect(reopened.id).toBe(testApp.conversation.id);
  await tools.close();
});

it('refuses messages to agents it does not know or to the sender itself', async () => {
  const { id, tools } = await toolsOfFirstAgent();
  expect(
    await call(tools, 'send_message', { agentId: UNKNOWN, text: 'hi' }),
  ).toMatchObject({ isError: true });
  expect(
    await call(tools, 'send_message', { agentId: UNKNOWN, text: '  ' }),
  ).toEqual({
    text: expect.not.stringContaining('There is no agent'),
    isError: true,
  });
  expect(
    await call(tools, 'send_message', { agentId: id, text: 'hi' }),
  ).toEqual({
    text: expect.stringContaining('An agent cannot message itself'),
    isError: true,
  });
  const stranger = await testApp.workspace.tools(UNKNOWN);
  expect(
    await call(stranger, 'send_message', { agentId: id, text: 'hi' }),
  ).toMatchObject({ isError: true });
  await stranger.close();
  await tools.close();
});

it('rejects tool calls that do not say which agent is calling', async () => {
  const response = await request(testApp.app.getHttpServer())
    .post('/mcp')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    .expect(400);
  expect(response.body.message).toBe(
    'Name the calling agent in the X-Choir-Agent header',
  );
});
