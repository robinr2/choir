import type { Client } from '@modelcontextprotocol/client';
import { z } from 'zod';
import { TestApp } from './test-app.js';
import { call, callForJson } from './workspace-client.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const testApp = TestApp.use();

let tools: Client;

beforeEach(async () => {
  tools = await testApp.workspace.tools(await testApp.workspace.firstAgent());
});

afterEach(async () => {
  await tools.close();
});

it('gives every agent the inbox tools', async () => {
  const { tools: listed } = await tools.listTools();
  expect(listed.map(({ name }) => name).slice(5)).toEqual([
    'list_notifications',
    'search_notifications',
    'grab_notification',
    'archive_notification',
    'unarchive_notification',
    'list_todos',
    'search_todos',
    'grab_todo',
    'archive_todo',
    'unarchive_todo',
    'create_todo',
    'edit_todo',
    'link_notification',
  ]);
  expect(listed.every(({ description = '' }) => description.length > 30)).toBe(
    true,
  );
  expect(tools.getInstructions()).toMatch(
    /hands you a to-do by its ID, take it with grab_todo/,
  );
});

it('lists, searches, archives and restores notifications', async () => {
  const { inbox } = testApp;
  const down = await inbox.notify({ title: 'Production is down' });
  await inbox.notify({ title: 'Lunch', text: 'Pizza today' });
  const listed = await callForJson<{ title: string }[]>(
    tools,
    'list_notifications',
  );
  expect(listed.map(({ title }) => title)).toEqual([
    'Production is down',
    'Lunch',
  ]);
  expect(
    await callForJson(tools, 'archive_notification', { notificationId: down }),
  ).toEqual({
    archived: true,
  });
  const found = await callForJson<{ id: string }[]>(
    tools,
    'search_notifications',
    {
      search: 'production',
    },
  );
  expect(found).toEqual([]);
  const archived = await callForJson<{ id: string }[]>(
    tools,
    'search_notifications',
    {
      search: 'production',
      archived: true,
    },
  );
  expect(archived.map(({ id }) => id)).toEqual([down]);
  expect(
    await callForJson(tools, 'unarchive_notification', {
      notificationId: down,
    }),
  ).toEqual({
    archived: false,
  });
  expect(await inbox.titles('notifications')).toEqual([
    'Production is down',
    'Lunch',
  ]);
  expect(
    await call(tools, 'archive_notification', { notificationId: UNKNOWN }),
  ).toEqual({
    text: expect.stringContaining(`There is no notification ${UNKNOWN}`),
    isError: true,
  });
});

it('grabs a notification with its images as images and its other attachments as files', async () => {
  const id = await testApp.inbox.notify({
    text: 'See the screenshot.',
    attachments: [
      { filename: 'screen.png', mediaType: 'image/png', contentBase64: 'cG5n' },
      { filename: 'log.txt', mediaType: 'text/plain', contentBase64: 'bG9n' },
    ],
  });
  const result = await tools.callTool({
    name: 'grab_notification',
    arguments: { notificationId: id },
  });
  expect(result.content).toEqual([
    {
      type: 'text',
      text: expect.stringContaining('"text":"See the screenshot."'),
    },
    { type: 'image', data: 'cG5n', mimeType: 'image/png' },
    {
      type: 'resource',
      resource: {
        uri: `http://localhost:3000/notifications/${id}/attachments/1`,
        mimeType: 'text/plain',
        blob: 'bG9n',
      },
    },
  ]);
});

it('creates to-dos from scratch and from a notification, edits them and links notifications', async () => {
  const { inbox } = testApp;
  const down = await inbox.notify({ title: 'Production is down' });
  const again = await inbox.notify({ title: 'Production is still down' });
  const plain = await callForJson<{ title: string; dueAt: null }>(
    tools,
    'create_todo',
    {
      title: 'Buy milk',
    },
  );
  expect(plain).toMatchObject({
    title: 'Buy milk',
    description: '',
    dueAt: null,
    notifications: [],
  });
  const todo = await callForJson<{ id: string }>(tools, 'create_todo', {
    title: 'Check why production is down',
    description: 'Start with the logs.',
    dueAt: '2026-10-01T17:00:00+02:00',
    notificationId: down,
  });
  expect(todo).toMatchObject({
    dueAt: '2026-10-01T15:00:00Z',
    notifications: [{ id: down }],
  });
  const edited = await callForJson(tools, 'edit_todo', {
    todoId: todo.id,
    description: 'Start with the logs. The boss asks too.',
    dueAt: null,
  });
  expect(edited).toMatchObject({
    title: 'Check why production is down',
    description: 'Start with the logs. The boss asks too.',
    dueAt: null,
  });
  const linked = await callForJson(tools, 'link_notification', {
    todoId: todo.id,
    notificationId: again,
  });
  expect(linked).toMatchObject({
    notifications: [{ id: down }, { id: again }],
  });
  const listed = await callForJson<{ description: string }[]>(
    tools,
    'list_todos',
  );
  expect(listed.map(({ description }) => description)).toEqual([
    '',
    'Start with the logs. The boss asks too.',
  ]);
  const found = await callForJson<{ title: string }[]>(tools, 'search_todos', {
    search: 'BOSS',
  });
  expect(found.map(({ title }) => title)).toEqual([
    'Check why production is down',
  ]);
});

it('archives a to-do when an agent grabs it and hands over the linked files', async () => {
  const { inbox } = testApp;
  const down = await inbox.notify({
    attachments: [
      { filename: 'graph.png', mediaType: 'image/png', contentBase64: 'cG5n' },
    ],
  });
  const id = await inbox.todo({
    title: 'Check production',
    notificationIds: [down],
  });
  const result = await tools.callTool({
    name: 'grab_todo',
    arguments: { todoId: id },
  });
  expect(result.content).toEqual([
    {
      type: 'text',
      text: expect.stringContaining('"title":"Check production"'),
    },
    { type: 'image', data: 'cG5n', mimeType: 'image/png' },
  ]);
  expect(await inbox.list('todos')).toEqual([]);
  expect(await callForJson(tools, 'unarchive_todo', { todoId: id })).toEqual({
    archived: false,
  });
  expect(await inbox.titles('todos')).toEqual(['Check production']);
  expect(await callForJson(tools, 'archive_todo', { todoId: id })).toEqual({
    archived: true,
  });
  const archived = await callForJson<{ title: string }[]>(
    tools,
    'search_todos',
    {
      search: 'production',
      archived: true,
    },
  );
  expect(archived.map(({ title }) => title)).toEqual(['Check production']);
  const bare = await inbox.todo({ title: 'Call Anna' });
  const grabbed = await tools.callTool({
    name: 'grab_todo',
    arguments: { todoId: bare },
  });
  expect(grabbed.content).toHaveLength(1);
});

const toolsSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.object({
      properties: z.record(
        z.string(),
        z.object({ description: z.string().optional() }),
      ),
    }),
  }),
);

async function describedTools() {
  const { tools: listed } = await tools.listTools();
  const described = toolsSchema.parse(listed);
  return (name: string, property?: string) => {
    const tool = described.find((candidate) => candidate.name === name);
    return property
      ? tool?.inputSchema.properties[property]?.description
      : tool?.description;
  };
}

it('describes what the inbox tools do and take', async () => {
  const describe = await describedTools();
  expect(describe('archive_todo')).toBe(
    "Archive a to-do, which takes it out of the user's active list.",
  );
  expect(describe('unarchive_notification')).toBe(
    "Take a notification out of the archive and back into the user's active list.",
  );
  expect(describe('archive_notification', 'notificationId')).toBe(
    'The ID of the notification',
  );
  expect(describe('grab_notification', 'notificationId')).toBe(
    'The ID of the notification',
  );
  expect(describe('create_todo', 'title')).toBe('A short title');
  expect(describe('create_todo', 'dueAt')).toMatch(/UTC offset in ISO 8601/);
  expect(describe('create_todo', 'notificationId')).toBe(
    'The ID of the notification',
  );
  expect(describe('edit_todo', 'todoId')).toBe('The ID of the to-do');
  expect(describe('edit_todo', 'dueAt')).toMatch(/ISO 8601/);
  expect(describe('unarchive_todo', 'todoId')).toBe('The ID of the to-do');
});

it('lists and searches only active entries unless asked, and refuses empty searches', async () => {
  const { inbox } = testApp;
  const old = await inbox.notify({ title: 'Old news' });
  await inbox.http
    .patch(`/notifications/${old}`)
    .send({ archived: true })
    .expect(204);
  const done = await inbox.todo({ title: 'Old job' });
  await inbox.http.patch(`/todos/${done}`).send({ archived: true }).expect(200);
  expect(await callForJson(tools, 'list_notifications')).toEqual([]);
  expect(await callForJson(tools, 'list_todos')).toEqual([]);
  expect(await callForJson(tools, 'search_todos', { search: 'old' })).toEqual(
    [],
  );
  const empty = await Promise.all(
    ['search_notifications', 'search_todos'].map((name) =>
      call(tools, name, { search: '  ' }),
    ),
  );
  expect(empty.map(({ isError }) => isError)).toEqual([true, true]);
});

it('grabs no to-do without an ID', async () => {
  const { inbox } = testApp;
  await inbox.todo({ title: 'Keep me' });
  expect(await call(tools, 'grab_todo', {})).toMatchObject({ isError: true });
  expect(await inbox.titles('todos')).toEqual(['Keep me']);
});
