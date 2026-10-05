import request from 'supertest';
import { AgentSession } from '../src/agent/agent-session.js';
import { EventStream } from './event-stream.js';
import { TestApp } from './test-app.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const testApp = TestApp.use();

async function emptyPane(): Promise<string> {
  const response = await testApp.workspace.send('post', 'panes').expect(201);
  return response.body.id;
}

function act(action: string, fields: object = {}) {
  return testApp.workspace.send('post', 'actions', { action, ...fields });
}

function column(paneId: string, width = 0.5) {
  return {
    id: expect.any(String),
    width,
    fullWidth: false,
    activeTile: 0,
    tiles: [{ paneId, height: { auto: 1 } }],
  };
}

function strip(columns: unknown[], activeColumn = 0) {
  return {
    id: expect.any(String),
    columns,
    activeColumn,
    restoresPrevious: false,
  };
}

it('starts with one idle agent in a half-wide column above an empty workspace and no voice', async () => {
  const id = await testApp.workspace.firstAgent();
  expect(await testApp.workspace.view()).toEqual({
    workspaces: [strip([column(id)]), strip([])],
    activeWorkspace: 0,
    panes: [{ id, kind: 'agent', name: 'agent 1', working: false }],
    voiceAgentId: null,
  });
});
it('opens empty panes as half-wide columns right after the focused column and focuses them', async () => {
  const first = await testApp.workspace.firstAgent();
  const right = await testApp.workspace.send('post', 'panes').expect(201);
  expect(right.body).toEqual({ id: expect.any(String), kind: 'empty' });
  await act('focusColumnLeft').expect(204);
  const middle = await emptyPane();
  const [shown] = (await testApp.workspace.view()).workspaces;
  expect(shown).toEqual({
    ...strip([column(first), column(middle), column(right.body.id)], 1),
    restoresPrevious: true,
  });
});

it('opens an agent or Excalidraw in an empty pane', async () => {
  const { workspace } = testApp;
  const left = await emptyPane();
  const right = await emptyPane();
  const agent = await workspace
    .send('put', `panes/${left}/content`, { kind: 'agent' })
    .expect(200);
  expect(agent.body).toEqual({ id: left, kind: 'agent', name: 'agent 2' });
  await workspace
    .send('put', `panes/${right}/content`, { kind: 'excalidraw' })
    .expect(200);
  expect((await workspace.view()).panes.slice(1)).toEqual([
    { id: left, kind: 'agent', name: 'agent 2', working: false },
    { id: right, kind: 'excalidraw' },
  ]);
});

it('keeps Excalidraw to one pane until that pane closes', async () => {
  const { workspace } = testApp;
  const first = await emptyPane();
  const second = await emptyPane();
  await workspace
    .send('put', `panes/${first}/content`, { kind: 'excalidraw' })
    .expect(200);
  const refused = await workspace
    .send('put', `panes/${second}/content`, { kind: 'excalidraw' })
    .expect(409);
  expect(refused.body.message).toBe(
    'Excalidraw is already open in another pane',
  );
  await workspace
    .send('put', `panes/${first}/content`, { kind: 'agent' })
    .expect(409);
  await workspace.send('delete', `panes/${first}`).expect(204);
  await workspace
    .send('put', `panes/${second}/content`, { kind: 'excalidraw' })
    .expect(200);
});

it('changes the layout and keeps it, the focus and the panes across restarts', async () => {
  const first = await testApp.workspace.firstAgent();
  const second = await emptyPane();
  const third = await emptyPane();
  await testApp.workspace
    .send('patch', `panes/${first}`, { name: ' reviewer ' })
    .expect(204);
  await act('consumeOrExpelWindowLeft').expect(204);
  await act('setWindowHeight', { change: 10 }).expect(204);
  await act('focusColumnLeft').expect(204);
  await act('maximizeColumn').expect(204);
  await act('moveColumnToWorkspaceDown').expect(204);
  await act('setColumnWidth', { change: -20 }).expect(204);
  const before = await testApp.workspace.view();
  expect(before.activeWorkspace).toBe(1);
  expect(before.workspaces).toEqual([
    strip([
      {
        ...column(second),
        activeTile: 1,
        tiles: [
          { paneId: second, height: { auto: 1 } },
          { paneId: third, height: { fixed: 0.6 } },
        ],
      },
    ]),
    strip([{ ...column(first), width: 0.8, fullWidth: false }]),
    strip([]),
  ]);
  await testApp.reopen();
  expect(await testApp.workspace.view()).toEqual(before);
  expect(before.panes).toEqual([
    { id: second, kind: 'empty' },
    { id: third, kind: 'empty' },
    { id: first, kind: 'agent', name: 'reviewer', working: false },
  ]);
});
it('ends the session of a closed agent', async () => {
  const close = vi.spyOn(AgentSession.prototype, 'close');
  const id = await testApp.workspace.firstAgent();
  await testApp.workspace.send('delete', `panes/${UNKNOWN}`).expect(404);
  await testApp.talkTo(id).say('echo hi');
  await testApp.workspace.send('delete', `panes/${id}`).expect(204);
  expect(close).toHaveBeenCalledOnce();
  expect(await testApp.workspace.view()).toEqual({
    workspaces: [strip([]), strip([])],
    activeWorkspace: 0,
    panes: [],
    voiceAgentId: null,
  });
});

it('shows which agents are working until their prompt ends', async () => {
  const id = await testApp.workspace.firstAgent();
  const conversation = testApp.talkTo(id);
  const running = conversation.say('stream-sleep 1000 thinking');
  await conversation.waitForAnswer('thinking');
  expect((await testApp.workspace.view()).panes[0]).toMatchObject({
    working: true,
  });
  await running;
  await vi.waitFor(async () =>
    expect((await testApp.workspace.view()).panes[0]).toMatchObject({
      working: false,
    }),
  );
});

it('turns voice on for one agent at a time and off when that agent closes', async () => {
  const { workspace } = testApp;
  const first = await workspace.firstAgent();
  const second = await emptyPane();
  await workspace.send('put', 'voice', { agentId: second }).expect(404);
  await workspace
    .send('put', `panes/${second}/content`, { kind: 'agent' })
    .expect(200);
  await workspace.send('put', 'voice', { agentId: UNKNOWN }).expect(404);
  await workspace.send('put', 'voice', { agentId: first }).expect(204);
  expect((await workspace.view()).voiceAgentId).toBe(first);
  await workspace.send('put', 'voice', { agentId: second }).expect(204);
  await workspace.send('delete', `panes/${first}`).expect(204);
  expect((await workspace.view()).voiceAgentId).toBe(second);
  await workspace.send('delete', `panes/${second}`).expect(204);
  expect((await workspace.view()).voiceAgentId).toBeNull();
  await workspace.send('put', 'voice', { agentId: null }).expect(204);
});

it('streams every change of the workspace', async () => {
  const events = await EventStream.page(testApp.app);
  try {
    await events.until('event: workspace\n');
    await events.until('"name":"agent 1"');
    const id = await emptyPane();
    await events.until(`{"id":"${id}","kind":"empty"}`);
  } finally {
    events.close();
  }
});

it('rejects workspace changes it cannot understand', async () => {
  const { app, workspace } = testApp;
  const id = await workspace.firstAgent();
  await act('flipColumn').expect(400);
  await act('setColumnWidth').expect(400);
  await act('focusPane', { paneId: UNKNOWN }).expect(404);
  await act('focusColumn', { columnId: UNKNOWN }).expect(404);
  await act('focusWorkspace', { workspaceId: UNKNOWN }).expect(404);
  await act('movePane', { paneId: id, column: 2 }).expect(400);
  await act('movePane', { paneId: id, column: 0, tile: -1 }).expect(400);
  await act('resizePane', { paneId: id, height: 1.5 }).expect(400);
  await workspace.send('patch', `panes/${id}`, { name: '' }).expect(400);
  await workspace
    .send('patch', `panes/${id}`, { name: 'x'.repeat(41) })
    .expect(400);
  await request(app.getHttpServer())
    .patch('/workspace/panes/not-a-uuid')
    .send({ name: 'x' })
    .expect(400);
  await workspace
    .send('put', `panes/${id}/content`, { kind: 'empty' })
    .expect(400);
  await workspace
    .send('put', `panes/${UNKNOWN}/content`, { kind: 'agent' })
    .expect(404);
  await workspace.send('put', 'voice', { agentId: 'nobody' }).expect(400);
});
