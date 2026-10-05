import { DatabaseService } from '../src/database/database.service.js';
import { EventStream, INBOX } from './event-stream.js';
import { TestApp } from './test-app.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const testApp = TestApp.use();

function recent(time: string): boolean {
  return Date.parse(time) > Date.now() - 60_000;
}

it('creates a to-do from scratch, with no due date and nothing linked', async () => {
  const { inbox } = testApp;
  const created = (
    await inbox.http.post('/todos').send({ title: '  Call Anna  ' }).expect(201)
  ).body;
  expect(created).toEqual({
    id: expect.any(String),
    title: 'Call Anna',
    description: '',
    preview: '',
    dueAt: null,
    createdAt: created.updatedAt,
    updatedAt: expect.any(String),
    archivedAt: null,
    notifications: [],
    attachments: [],
  });
  expect(recent(created.createdAt)).toBe(true);
  expect(await inbox.list('todos')).toEqual([
    {
      id: created.id,
      title: 'Call Anna',
      description: '',
      preview: '',
      dueAt: null,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      archivedAt: null,
    },
  ]);
});

it('creates a to-do from notifications and carries their images and attachments', async () => {
  const { inbox } = testApp;
  const down = await inbox.notify(
    {
      attachments: [
        { filename: 'log.txt', mediaType: 'text/plain', contentBase64: 'bG9n' },
        {
          filename: 'graph.png',
          mediaType: 'image/png',
          contentBase64: 'cG5n',
        },
      ],
    },
    { source: 'teams' },
  );
  const again = await inbox.notify({ title: 'Still down' });
  const id = await inbox.todo({
    title: 'Check why production is down',
    description:
      'Look at the logs of the login service first, then tell the team what you found.',
    dueAt: '2026-10-01T17:00:00+02:00',
    notificationIds: [down, again, down],
  });
  const todo = (await inbox.http.get(`/todos/${id}`).expect(200)).body;
  expect(todo).toMatchObject({
    preview: 'Look at the logs of the login service first, then …',
    dueAt: '2026-10-01T15:00:00Z',
    notifications: [
      {
        id: down,
        source: 'teams',
        title: 'Production is down',
        sentAt: '2026-09-28T06:14:03Z',
      },
      {
        id: again,
        source: 'outlook',
        title: 'Still down',
        sentAt: '2026-09-28T06:14:03Z',
      },
    ],
    attachments: [
      {
        notificationId: down,
        index: 0,
        filename: 'log.txt',
        mediaType: 'text/plain',
      },
      {
        notificationId: down,
        index: 1,
        filename: 'graph.png',
        mediaType: 'image/png',
      },
    ],
  });
  expect(await inbox.titles('notifications')).toHaveLength(2);
});

it('refuses to-dos that are not valid or link notifications that do not exist', async () => {
  const { inbox } = testApp;
  await inbox.http.post('/todos').send({ title: ' ' }).expect(400);
  await inbox.http
    .post('/todos')
    .send({ title: 'x'.repeat(201) })
    .expect(400);
  await inbox.http
    .post('/todos')
    .send({ title: 'Call', dueAt: 'tomorrow' })
    .expect(400);
  const missing = await inbox.http
    .post('/todos')
    .send({ title: 'Call', notificationIds: [UNKNOWN] })
    .expect(404);
  expect(missing.body.message).toBe(`There is no notification ${UNKNOWN}`);
  await inbox.http.get(`/todos/${UNKNOWN}`).expect(404);
  expect(await inbox.list('todos')).toEqual([]);
});

it('saves changes to the title, description and due date, and marks the last change', async () => {
  const { inbox } = testApp;
  const id = await inbox.todo({
    title: 'Call Anna',
    dueAt: '2026-10-01T17:00:00Z',
  });
  const before = (await inbox.http.get(`/todos/${id}`).expect(200)).body;
  const changed = (
    await inbox.http
      .patch(`/todos/${id}`)
      .send({ title: 'Call Anna back', description: 'About the offer' })
      .expect(200)
  ).body;
  expect(changed).toMatchObject({
    title: 'Call Anna back',
    description: 'About the offer',
    dueAt: '2026-10-01T17:00:00Z',
    createdAt: before.createdAt,
  });
  expect(Date.parse(changed.updatedAt)).toBeGreaterThan(
    Date.parse(before.updatedAt),
  );
  const undated = (
    await inbox.http.patch(`/todos/${id}`).send({ dueAt: null }).expect(200)
  ).body;
  expect(undated).toMatchObject({ title: 'Call Anna back', dueAt: null });
  await inbox.http.patch(`/todos/${UNKNOWN}`).send({ title: 'x' }).expect(404);
  await inbox.http.patch(`/todos/${id}`).send({ title: '' }).expect(400);
});

it('archives to-dos, keeps them and brings them back, counting as a change', async () => {
  const { inbox } = testApp;
  const id = await inbox.todo({
    title: 'Call Anna',
    description: 'About the offer',
  });
  const archived = (
    await inbox.http.patch(`/todos/${id}`).send({ archived: true }).expect(200)
  ).body;
  expect(archived.archivedAt).toBe(archived.updatedAt);
  expect(await inbox.list('todos')).toEqual([]);
  expect(
    await inbox.titles('todos', { archived: 'true', search: 'OFFER' }),
  ).toEqual(['Call Anna']);
  expect(await inbox.titles('todos', { search: 'offer' })).toEqual([]);
  const restored = (
    await inbox.http.patch(`/todos/${id}`).send({ archived: false }).expect(200)
  ).body;
  expect(restored.archivedAt).toBeNull();
  expect(await inbox.titles('todos', { search: 'anna' })).toEqual([
    'Call Anna',
  ]);
});

it('links notifications to an existing to-do once each', async () => {
  const { inbox } = testApp;
  const first = await inbox.notify({ title: 'Production is down' });
  const second = await inbox.notify({ title: 'Production is still down' });
  const id = await inbox.todo({
    title: 'Check production',
    notificationIds: [first],
  });
  const before = (await inbox.http.get(`/todos/${id}`).expect(200)).body;
  await inbox.http
    .post(`/todos/${id}/notifications`)
    .send({ notificationId: second })
    .expect(201);
  const linked = (
    await inbox.http
      .post(`/todos/${id}/notifications`)
      .send({ notificationId: first })
      .expect(201)
  ).body;
  expect(
    linked.notifications.map(({ id: linkedId }: { id: string }) => linkedId),
  ).toEqual([first, second]);
  expect(Date.parse(linked.updatedAt)).toBeGreaterThan(
    Date.parse(before.updatedAt),
  );
  await inbox.http
    .post(`/todos/${UNKNOWN}/notifications`)
    .send({ notificationId: first })
    .expect(404);
  await inbox.http
    .post(`/todos/${id}/notifications`)
    .send({ notificationId: UNKNOWN })
    .expect(404);
  expect(
    (await inbox.http.get(`/todos/${id}`).expect(200)).body.notifications,
  ).toHaveLength(2);
});

it('moves to-dos where the user drops them, new ones at the bottom', async () => {
  const { inbox } = testApp;
  const first = await inbox.todo({ title: 'first' });
  await inbox.todo({ title: 'second' });
  const third = await inbox.todo({ title: 'third' });
  await inbox.http
    .put(`/todos/${third}/position`)
    .send({ before: first })
    .expect(204);
  await inbox.http
    .put(`/todos/${first}/position`)
    .send({ after: third })
    .expect(204);
  expect(await inbox.titles('todos')).toEqual(['third', 'first', 'second']);
  await inbox.http
    .put(`/todos/${UNKNOWN}/position`)
    .send({ after: third })
    .expect(404);
});

it('numbers the to-dos anew when two sit too close for one between them', async () => {
  const { inbox } = testApp;
  await inbox.todo({ title: 'first' });
  const second = await inbox.todo({ title: 'second' });
  const third = await inbox.todo({ title: 'third' });
  const { orm } = testApp.app.get(DatabaseService);
  await orm.Todo.where({ id: second }).update({ position: 1 + Number.EPSILON });
  await inbox.http
    .put(`/todos/${third}/position`)
    .send({ before: second })
    .expect(204);
  expect(await inbox.titles('todos')).toEqual(['first', 'third', 'second']);
});

it('keeps an archived to-do archived when only its title changes', async () => {
  const { inbox } = testApp;
  const id = await inbox.todo({ title: 'Call Anna' });
  await inbox.http.patch(`/todos/${id}`).send({ archived: true }).expect(200);
  const renamed = (
    await inbox.http
      .patch(`/todos/${id}`)
      .send({ title: 'Call Ben' })
      .expect(200)
  ).body;
  expect(renamed.archivedAt).not.toBeNull();
});

it('names the missing one among the notifications to link and the to-dos to change', async () => {
  const { inbox } = testApp;
  const known = await inbox.notify();
  const created = await inbox.http
    .post('/todos')
    .send({ title: 'Call', notificationIds: [known, UNKNOWN] })
    .expect(404);
  expect(created.body.message).toBe(`There is no notification ${UNKNOWN}`);
  const changed = await inbox.http
    .patch(`/todos/${UNKNOWN}`)
    .send({ title: 'x' })
    .expect(404);
  expect(changed.body.message).toBe(`There is no to-do ${UNKNOWN}`);
  const linked = await inbox.http
    .post(`/todos/${UNKNOWN}/notifications`)
    .send({ notificationId: known })
    .expect(404);
  expect(linked.body.message).toBe(`There is no to-do ${UNKNOWN}`);
  const moved = await inbox.http
    .put(`/todos/${UNKNOWN}/position`)
    .send({ after: UNKNOWN })
    .expect(404);
  expect(moved.body.message).toBe(`There is no to-do ${UNKNOWN}`);
});

it('links one notification to several to-dos', async () => {
  const { inbox } = testApp;
  const down = await inbox.notify();
  const first = await inbox.todo({
    title: 'Check the logs',
    notificationIds: [down],
  });
  const second = await inbox.todo({ title: 'Tell the customers' });
  await inbox.http
    .post(`/todos/${second}/notifications`)
    .send({ notificationId: down })
    .expect(201);
  const todos = await Promise.all(
    [first, second].map(
      async (id) => (await inbox.http.get(`/todos/${id}`).expect(200)).body,
    ),
  );
  expect(
    todos.map(({ notifications }) =>
      notifications.map(({ id: linked }: { id: string }) => linked),
    ),
  ).toEqual([[down], [down]]);
});

it('moves among many to-dos next to the neighbour and keeps new ones at the bottom', async () => {
  const { inbox } = testApp;
  const ids = [
    await inbox.todo({ title: 'a' }),
    await inbox.todo({ title: 'b' }),
    await inbox.todo({ title: 'c' }),
    await inbox.todo({ title: 'd' }),
  ];
  await inbox.http
    .put(`/todos/${ids[3]}/position`)
    .send({ after: ids[0] })
    .expect(204);
  expect(await inbox.titles('todos')).toEqual(['a', 'd', 'b', 'c']);
  await inbox.http
    .put(`/todos/${ids[0]}/position`)
    .send({ before: ids[2] })
    .expect(204);
  expect(await inbox.titles('todos')).toEqual(['d', 'b', 'a', 'c']);
  await inbox.http
    .put(`/todos/${ids[2]}/position`)
    .send({ before: ids[3] })
    .expect(204);
  await inbox.todo({ title: 'e' });
  expect(await inbox.titles('todos')).toEqual(['c', 'd', 'b', 'a', 'e']);
});

it('tells the app about every change to a to-do', async () => {
  const { inbox } = testApp;
  const down = await inbox.notify();
  const [first, second] = [
    await inbox.todo({ title: 'a' }),
    await inbox.todo({ title: 'b' }),
  ];
  const stream = await EventStream.page(testApp.app);
  await stream.until(INBOX);
  await inbox.http.patch(`/todos/${first}`).send({ title: 'c' }).expect(200);
  await stream.until(INBOX, 2);
  await inbox.http
    .post(`/todos/${first}/notifications`)
    .send({ notificationId: down })
    .expect(201);
  await stream.until(INBOX, 3);
  await inbox.http
    .put(`/todos/${second}/position`)
    .send({ before: first })
    .expect(204);
  await stream.until(INBOX, 4);
  stream.close();
});

it('takes a long description as JSON', async () => {
  const { inbox } = testApp;
  const description = 'x'.repeat(300_000);
  const id = await inbox.todo({ title: 'Read this', description });
  expect(
    (await inbox.http.get(`/todos/${id}`).expect(200)).body.description,
  ).toHaveLength(300_000);
});

it('moves a to-do right above its neighbour when several lie above', async () => {
  const { inbox } = testApp;
  const ids = await inbox.each('todos', ['a', 'b', 'c', 'd', 'e']);
  await inbox.http
    .put(`/todos/${ids[4]}/position`)
    .send({ before: ids[3] })
    .expect(204);
  expect(await inbox.titles('todos')).toEqual(['a', 'b', 'c', 'e', 'd']);
});

it('refuses to-do addresses that are no ID', async () => {
  const { inbox } = testApp;
  await inbox.http.get('/todos/not-an-id').expect(400);
  await inbox.http.patch('/todos/not-an-id').send({ title: 'x' }).expect(400);
  await inbox.http
    .post('/todos/not-an-id/notifications')
    .send({ notificationId: UNKNOWN })
    .expect(400);
  await inbox.http
    .put('/todos/not-an-id/position')
    .send({ after: UNKNOWN })
    .expect(400);
});
