import { AcpxRuntime } from 'acpx/runtime';
import request from 'supertest';
import { EventStream } from './event-stream.js';
import { TestApp } from './test-app.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const testApp = TestApp.use();

function split(children: unknown[], splitPercentages: number[]) {
  return { type: 'split', direction: 'row', children, splitPercentages };
}

async function emptyPaneAt(edge: string): Promise<string> {
  const response = await testApp.workspace
    .send('post', 'edges', { edge })
    .expect(201);
  return response.body.id;
}

it('starts with one idle agent and no voice', async () => {
  const id = await testApp.workspace.firstAgent();
  expect(await testApp.workspace.view()).toEqual({
    layout: id,
    panes: [{ id, kind: 'agent', name: 'agent 1', working: false }],
    voiceAgentId: null,
  });
});

it('adds empty panes by splitting panes or at the outer edges', async () => {
  const { workspace } = testApp;
  const first = await workspace.firstAgent();
  const right = await workspace
    .send('post', 'splits', { paneId: first, direction: 'vertical' })
    .expect(201);
  expect(right.body).toEqual({ id: expect.any(String), kind: 'empty' });
  const top = await workspace
    .send('post', 'edges', { edge: 'top' })
    .expect(201);
  expect(top.body.kind).toBe('empty');
  const view = await workspace.view();
  expect(view.layout).toEqual({
    type: 'split',
    direction: 'column',
    children: [top.body.id, split([first, right.body.id], [50, 50])],
    splitPercentages: [50, 50],
  });
  expect(view.panes.slice(1)).toEqual([
    { id: right.body.id, kind: 'empty' },
    { id: top.body.id, kind: 'empty' },
  ]);
});

it('opens an agent or Excalidraw in an empty pane', async () => {
  const { workspace } = testApp;
  const left = await emptyPaneAt('left');
  const right = await emptyPaneAt('right');
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
  const first = await emptyPaneAt('left');
  const second = await emptyPaneAt('right');
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

it('swaps, resizes, renames and closes panes and keeps them across restarts', async () => {
  const { workspace } = testApp;
  const first = await workspace.firstAgent();
  const second = await emptyPaneAt('right');
  await workspace
    .send('put', `panes/${second}/content`, { kind: 'agent' })
    .expect(200);
  await workspace.send('post', 'swaps', { first, second }).expect(204);
  const layout = split([second, first], [30, 70]);
  await workspace.send('put', 'layout', { layout }).expect(204);
  await workspace
    .send('patch', `panes/${second}`, { name: ' reviewer ' })
    .expect(204);
  await testApp.reopen();
  expect(await testApp.workspace.view()).toEqual({
    layout,
    panes: [
      { id: first, kind: 'agent', name: 'agent 1', working: false },
      { id: second, kind: 'agent', name: 'reviewer', working: false },
    ],
    voiceAgentId: null,
  });
  await testApp.workspace.send('delete', `panes/${first}`).expect(204);
  expect((await testApp.workspace.view()).layout).toBe(second);
});

it('ends the session of a closed agent', async () => {
  const close = vi.spyOn(AcpxRuntime.prototype, 'close');
  const id = await testApp.workspace.firstAgent();
  await testApp.workspace.send('delete', `panes/${UNKNOWN}`).expect(404);
  await testApp.talkTo(id).say('echo hi');
  await testApp.workspace.send('delete', `panes/${id}`).expect(204);
  expect(close).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      handle: expect.objectContaining({ sessionKey: id }),
      reason: 'The agent was closed',
    }),
  );
  expect(await testApp.workspace.view()).toEqual({
    layout: null,
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
  const second = await emptyPaneAt('left');
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
  const events = await EventStream.open(testApp.app, '/workspace/events');
  try {
    await events.until('"name":"agent 1"');
    const id = await emptyPaneAt('bottom');
    await events.until(`{"id":"${id}","kind":"empty"}`);
  } finally {
    events.close();
  }
});

it('checks the panes and percentages of a resized layout', async () => {
  const { workspace } = testApp;
  const first = await workspace.firstAgent();
  const second = await emptyPaneAt('right');
  const third = await emptyPaneAt('right');
  const panes = [first, second, third];
  await workspace
    .send('put', 'layout', { layout: split(panes, [20, 30, 50]) })
    .expect(204);
  const unequal = await workspace
    .send('put', 'layout', { layout: split(panes, [50, 50]) })
    .expect(400);
  expect(JSON.stringify(unequal.body)).toContain(
    'A split needs two or more panes and one percentage per pane, adding up to 100',
  );
  await workspace
    .send('put', 'layout', { layout: split(panes, [20, 30, 60]) })
    .expect(400);
  await workspace
    .send('put', 'layout', { layout: split(panes, [20, 30, 49.6]) })
    .expect(204);
});

it('rejects workspace changes it cannot understand', async () => {
  const { app, workspace } = testApp;
  const id = await workspace.firstAgent();
  await workspace
    .send('post', 'splits', { paneId: id, direction: 'diagonal' })
    .expect(400);
  await workspace
    .send('post', 'splits', { paneId: UNKNOWN, direction: 'vertical' })
    .expect(404);
  await workspace.send('post', 'edges', { edge: 'middle' }).expect(400);
  await workspace.send('post', 'swaps', { first: id }).expect(400);
  await workspace.send('put', 'layout', { layout: UNKNOWN }).expect(400);
  await workspace
    .send('put', 'layout', { layout: split([id, id], [60, 60]) })
    .expect(400);
  await workspace
    .send('put', 'layout', { layout: split([id, id], [100]) })
    .expect(400);
  await workspace
    .send('put', 'layout', { layout: split([id], [100]) })
    .expect(400);
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
