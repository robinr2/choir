import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import type { SessionListing } from '../src/agent/agent-catalog.js';
import { TestApp } from './test-app.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const testApp = TestApp.use();

function get(url: string) {
  return request(testApp.app.getHttpServer()).get(url);
}

async function emptyPane(): Promise<string> {
  const response = await testApp.workspace.send('post', 'panes').expect(201);
  return response.body.id;
}

function launch(paneId: string, launched?: object) {
  return testApp.workspace.send('put', `panes/${paneId}/content`, {
    kind: 'agent',
    ...(launched && { launch: launched }),
  });
}

async function answer(paneId: string, text: string): Promise<string> {
  const { text: events } = await testApp.talkTo(paneId).say(text);
  const [, data = ''] = /^data: (.*)$/m.exec(events) ?? [];
  return JSON.parse(data).text;
}

async function sessions(): Promise<SessionListing[]> {
  return (await get('/agent-sessions').expect(200)).body;
}

function defaultFolder(): string {
  return path.join(testApp.dataDir, 'default');
}

it('describes the models, efforts and modes an agent can start with', async () => {
  const { body } = await get('/agent-catalog').expect(200);
  expect(body.models.map(({ value }: { value: string }) => value)).toEqual([
    'default',
    'opus',
    'haiku',
  ]);
  expect(body.defaults).toEqual({
    cwd: defaultFolder(),
    model: 'default',
    effort: 'default',
    mode: 'bypassPermissions',
  });
});

it('starts an agent in a pane with the folder, model, effort and mode it was launched with', async () => {
  const folder = path.join(testApp.dataDir, 'project');
  await mkdir(folder);
  const id = await emptyPane();
  const settings = { model: 'opus', effort: 'high', mode: 'plan' };
  const { body } = await launch(id, { cwd: folder, ...settings }).expect(200);
  expect(body).toEqual({ id, kind: 'agent', name: 'agent 2' });
  expect(JSON.parse(await answer(id, 'config'))).toEqual({
    ...settings,
    fast: false,
  });
  expect(await answer(id, 'cwd')).toBe(folder);
  await testApp.reopen();
  expect(await testApp.talkTo(id).userTexts()).toEqual(['config', 'cwd']);
});

it('resumes a session in a pane, as it is or as a fork, and deletes sessions', async () => {
  const first = await testApp.workspace.firstAgent();
  await testApp.talkTo(first).say('echo hi');
  const [original] = await sessions();
  const resume = { resume: original?.sessionId, cwd: defaultFolder() };
  const resumed = await emptyPane();
  await launch(resumed, resume).expect(200);
  expect(await testApp.talkTo(resumed).userTexts()).toEqual(['echo hi']);
  const forked = await emptyPane();
  await launch(forked, { ...resume, fork: true }).expect(200);
  expect(await testApp.talkTo(forked).userTexts()).toEqual(['echo hi']);
  expect(await sessions()).toHaveLength(2);
  await request(testApp.app.getHttpServer())
    .delete(`/agent-sessions/${original?.sessionId}`)
    .expect(204);
  expect(await sessions()).toHaveLength(1);
});

it('opens a conversation in a new pane right of another pane, or focuses its pane', async () => {
  const { workspace } = testApp;
  const first = await workspace.firstAgent();
  await emptyPane();
  const conversationId = crypto.randomUUID();
  const opening = { conversationId, nextTo: first };
  const { body } = await workspace.send('post', 'panes', opening).expect(201);
  expect(body).toEqual({ id: conversationId, kind: 'agent', name: 'agent 2' });
  const [shown] = (await workspace.view()).workspaces;
  expect(shown?.columns.map(({ tiles: [tile] }) => tile?.paneId)).toEqual([
    first,
    conversationId,
    expect.any(String),
  ]);
  expect(shown?.activeColumn).toBe(1);
  await workspace.send('post', 'actions', { action: 'focusColumnLeft' });
  await workspace.send('post', 'panes', opening).expect(201);
  expect((await workspace.view()).workspaces[0]?.activeColumn).toBe(1);
  expect((await workspace.view()).panes).toHaveLength(3);
});

it('lists the folders an agent can start in', async () => {
  const folder = defaultFolder();
  await mkdir(path.join(folder, 'beta'));
  await mkdir(path.join(folder, 'alpha'));
  await mkdir(path.join(folder, '.hidden'));
  const { body } = await get('/folders').expect(200);
  expect(body).toEqual({
    path: folder,
    parent: testApp.dataDir,
    folders: [
      { name: 'alpha', path: path.join(folder, 'alpha') },
      { name: 'beta', path: path.join(folder, 'beta') },
    ],
  });
  const root = await get('/folders').query({ path: '/' }).expect(200);
  expect(root.body).toMatchObject({ path: '/', parent: null });
  expect(root.body.folders).toContainEqual({ name: 'tmp', path: '/tmp' });
});

it('rejects launches, panes and folders it cannot understand', async () => {
  const { workspace } = testApp;
  const first = await workspace.firstAgent();
  const id = await emptyPane();
  await launch(id, { cwd: 'relative' }).expect(400);
  await launch(id, { cwd: defaultFolder(), model: ' ' }).expect(400);
  await launch(id, { resume: 'nope', cwd: defaultFolder() }).expect(400);
  await launch(first, { cwd: defaultFolder(), mode: 'plan' }).expect(409);
  expect(await answer(first, 'mode')).toBe('bypassPermissions');
  await workspace
    .send('post', 'panes', { conversationId: UNKNOWN, nextTo: UNKNOWN })
    .expect(404);
  await workspace
    .send('post', 'panes', { conversationId: 'x', nextTo: first })
    .expect(400);
  await get('/folders').query({ path: 'relative' }).expect(400);
  const missing = await get('/folders')
    .query({ path: '/nonexistent/folder' })
    .expect(400);
  expect(missing.body.message).toBe('There is no folder /nonexistent/folder');
  await request(testApp.app.getHttpServer())
    .delete('/agent-sessions/not-a-uuid')
    .expect(400);
});
