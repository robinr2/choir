import { DatabaseService } from '../src/database/database.service.js';
import { EventStream } from './event-stream.js';
import { CLOUDEVENTS, notificationEvent } from './inbox-client.js';
import { TestApp } from './test-app.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const PNG = Buffer.from('fake image').toString('base64');

const testApp = TestApp.use();

it('takes a pushed notification into the list, with its source and the time of the original', async () => {
  const { inbox } = testApp;
  const id = await inbox.notify(
    {
      text: 'Hi Sam,\n  production is down since eight and the customers cannot log in at all today.',
    },
    { source: 'outlook/sam', time: '2026-09-28T08:14:03.250+02:00' },
  );
  expect(await inbox.list('notifications')).toEqual([
    {
      id,
      source: 'outlook/sam',
      title: 'Production is down',
      preview: 'Hi Sam, production is down since eight and the customers …',
      sentAt: '2026-09-28T06:14:03.25Z',
      archivedAt: null,
    },
  ]);
  expect(
    (await inbox.http.get(`/notifications/${id}`).expect(200)).body,
  ).toEqual({
    id,
    source: 'outlook/sam',
    title: 'Production is down',
    preview: 'Hi Sam, production is down since eight and the customers …',
    text: 'Hi Sam,\n  production is down since eight and the customers cannot log in at all today.',
    link: null,
    sentAt: '2026-09-28T06:14:03.25Z',
    archivedAt: null,
    attachments: [],
  });
});

it('keeps one notification for retries of a push and two for a message that arrives twice', async () => {
  const { inbox } = testApp;
  const event = notificationEvent();
  const first = await inbox.push(event).expect(201);
  const retry = await inbox.push(event).expect(200);
  expect(retry.body).toEqual(first.body);
  await inbox.push({ ...event, source: 'teams' }).expect(201);
  await inbox.push(notificationEvent()).expect(201);
  expect(await inbox.titles('notifications')).toHaveLength(3);
  expect(testApp.judged).toHaveBeenCalledTimes(3);
});

it('accepts only CloudEvents of choir notifications', async () => {
  const { inbox } = testApp;
  const reply = await inbox.http
    .post('/notifications')
    .send(notificationEvent())
    .expect(415);
  expect(reply.body.message).toBe(`Send the notification as ${CLOUDEVENTS}`);
  const text = await inbox.http
    .post('/notifications')
    .set('Content-Type', 'text/plain')
    .send('hi')
    .expect(400);
  expect(text.body.message).toEqual([
    'Invalid input: expected object, received undefined',
  ]);
  await inbox
    .push(notificationEvent({}, { type: 'com.example.other' }))
    .expect(400);
  await inbox.push(notificationEvent({}, { time: 'yesterday' })).expect(400);
  await inbox.push(notificationEvent({ title: '  ' })).expect(400);
  await inbox.push(notificationEvent({ link: 'no link' })).expect(400);
  expect(await inbox.list('notifications')).toEqual([]);
});

it('keeps the images and attachments as files and links back to the original', async () => {
  const { inbox } = testApp;
  const id = await inbox.notify({
    link: 'https://outlook.example/mail/1',
    attachments: [
      {
        filename: 'screen shot.png',
        mediaType: 'image/png',
        contentBase64: PNG,
      },
      {
        filename: 'Bericht für März.pdf',
        mediaType: 'application/pdf',
        contentBase64: 'JVBERg==',
      },
    ],
  });
  const detail = (await inbox.http.get(`/notifications/${id}`).expect(200))
    .body;
  expect(detail.link).toBe('https://outlook.example/mail/1');
  expect(detail.attachments).toEqual([
    { index: 0, filename: 'screen shot.png', mediaType: 'image/png' },
    {
      index: 1,
      filename: 'Bericht für März.pdf',
      mediaType: 'application/pdf',
    },
  ]);
  const image = await inbox.http
    .get(`/notifications/${id}/attachments/0`)
    .expect(200);
  expect(image.headers['content-type']).toBe('image/png');
  expect(image.headers['content-disposition']).toBe(
    "inline; filename*=UTF-8''screen%20shot.png",
  );
  expect(image.body.toString()).toBe('fake image');
  const pdf = await inbox.http
    .get(`/notifications/${id}/attachments/1`)
    .expect(200);
  expect(pdf.headers['content-disposition']).toBe(
    "inline; filename*=UTF-8''Bericht%20f%C3%BCr%20M%C3%A4rz.pdf",
  );
  await inbox.http.get(`/notifications/${id}/attachments/2`).expect(404);
  await inbox.http.get(`/notifications/${id}/attachments/first`).expect(400);
  await inbox.http.get(`/notifications/${UNKNOWN}`).expect(404);
  await inbox.http.get('/notifications/not-an-id').expect(400);
});

it('searches title and text, and the archive only when asked', async () => {
  const { inbox } = testApp;
  const down = await inbox.notify({
    title: 'Production is down',
    text: 'The login fails.',
  });
  await inbox.notify({ title: 'Lunch', text: '50% off_today \\ only' });
  await inbox.notify({
    title: 'Review',
    text: 'Please review my merge request.',
  });
  await inbox.http
    .patch(`/notifications/${down}`)
    .send({ archived: true })
    .expect(204);
  expect(await inbox.titles('notifications', { search: 'LOGIN' })).toEqual([]);
  expect(
    await inbox.titles('notifications', { search: 'login', archived: 'true' }),
  ).toEqual(['Production is down']);
  expect(await inbox.titles('notifications', { search: 'review' })).toEqual([
    'Review',
  ]);
  expect(await inbox.titles('notifications', { search: '50%' })).toEqual([
    'Lunch',
  ]);
  expect(await inbox.titles('notifications', { search: 'f_t' })).toEqual([
    'Lunch',
  ]);
  expect(await inbox.titles('notifications', { search: '_ff' })).toEqual([]);
  expect(await inbox.titles('notifications', { search: '\\' })).toEqual([
    'Lunch',
  ]);
  expect(await inbox.titles('notifications', { search: '  ' })).toEqual([
    'Lunch',
    'Review',
  ]);
});

it('archives notifications and takes them out of the archive again', async () => {
  const { inbox } = testApp;
  const id = await inbox.notify();
  await inbox.http
    .patch(`/notifications/${id}`)
    .send({ archived: true })
    .expect(204);
  expect(await inbox.list('notifications')).toEqual([]);
  const [archived] = await inbox.list('notifications', { archived: 'true' });
  expect(Date.parse(archived.archivedAt)).toBeGreaterThan(Date.now() - 60_000);
  await inbox.http
    .patch(`/notifications/${id}`)
    .send({ archived: false })
    .expect(204);
  expect((await inbox.list('notifications'))[0].archivedAt).toBeNull();
  await inbox.http
    .patch(`/notifications/${UNKNOWN}`)
    .send({ archived: true })
    .expect(404);
  await inbox.http
    .patch(`/notifications/${id}`)
    .send({ archived: 'yes' })
    .expect(400);
});

it('puts new notifications at the bottom and moves them where the user drops them', async () => {
  const { inbox } = testApp;
  const [first, second, third] = [
    await inbox.notify({ title: 'first' }),
    await inbox.notify({ title: 'second' }),
    await inbox.notify({ title: 'third' }),
  ];
  const move = (id: string, placement: object) =>
    inbox.http.put(`/notifications/${id}/position`).send(placement);
  await move(third, { before: first }).expect(204);
  expect(await inbox.titles('notifications')).toEqual([
    'third',
    'first',
    'second',
  ]);
  await move(third, { after: first }).expect(204);
  expect(await inbox.titles('notifications')).toEqual([
    'first',
    'third',
    'second',
  ]);
  await move(first, { after: second }).expect(204);
  expect(await inbox.titles('notifications')).toEqual([
    'third',
    'second',
    'first',
  ]);
  await move(first, { before: third }).expect(204);
  expect(await inbox.titles('notifications')).toEqual([
    'first',
    'third',
    'second',
  ]);
  await move(UNKNOWN, { before: third }).expect(404);
  await move(first, { before: UNKNOWN }).expect(404);
  await move(first, { before: third, after: second }).expect(400);
});

it('streams the counts of active notifications and to-dos as they change', async () => {
  const { inbox } = testApp;
  const stream = await EventStream.open(testApp.app, '/inbox/events');
  await stream.until('"notifications":0,"todos":0');
  const id = await inbox.notify();
  await stream.until('"notifications":1,"todos":0');
  await inbox.todo({ title: 'Check the logs', notificationIds: [id] });
  await stream.until('"notifications":1,"todos":1');
  await inbox.http
    .patch(`/notifications/${id}`)
    .send({ archived: true })
    .expect(204);
  await stream.until('"notifications":0,"todos":1');
  stream.close();
});

it('numbers the notifications anew when two sit too close for one between them', async () => {
  const { inbox } = testApp;
  const [first, second, third] = [
    await inbox.notify({ title: 'first' }),
    await inbox.notify({ title: 'second' }),
    await inbox.notify({ title: 'third' }),
  ];
  const { orm } = testApp.app.get(DatabaseService);
  await orm.Notification.where({ id: second }).update({
    position: 1 + Number.EPSILON,
  });
  await inbox.http
    .put(`/notifications/${third}/position`)
    .send({ after: first })
    .expect(204);
  expect(await inbox.titles('notifications')).toEqual([
    'first',
    'third',
    'second',
  ]);
});

it('takes CloudEvents with a charset and large attachments, and refuses blank names', async () => {
  const { inbox } = testApp;
  const large = Buffer.alloc(300_000, 1).toString('base64');
  const event = notificationEvent(
    {
      attachments: [
        {
          filename: 'big.bin',
          mediaType: 'application/octet-stream',
          contentBase64: large,
        },
      ],
    },
    { datacontenttype: 'application/json' },
  );
  await inbox.http
    .post('/notifications')
    .set('Content-Type', `${CLOUDEVENTS}; charset=utf-8`)
    .send(event)
    .expect(201);
  const blank = {
    filename: '  ',
    mediaType: 'text/plain',
    contentBase64: 'YQ==',
  };
  await inbox.push(notificationEvent({ attachments: [blank] })).expect(400);
  await inbox
    .push(
      notificationEvent({
        attachments: [{ ...blank, filename: 'a', mediaType: ' ' }],
      }),
    )
    .expect(400);
  await inbox.push(notificationEvent({}, { source: '  ' })).expect(400);
  expect(await inbox.titles('notifications')).toHaveLength(1);
});

it('says which notification or attachment it cannot find', async () => {
  const { inbox } = testApp;
  const id = await inbox.notify();
  const missing = await inbox.http.get(`/notifications/${UNKNOWN}`).expect(404);
  expect(missing.body.message).toBe(`There is no notification ${UNKNOWN}`);
  const file = await inbox.http
    .get(`/notifications/${id}/attachments/3`)
    .expect(404);
  expect(file.body.message).toBe(`Notification ${id} has no attachment 3`);
  const moved = await inbox.http
    .put(`/notifications/${UNKNOWN}/position`)
    .send({ after: id })
    .expect(404);
  expect(moved.body.message).toBe(`There is no notification ${UNKNOWN}`);
});

it('moves among many notifications next to the neighbour and keeps new ones at the bottom', async () => {
  const { inbox } = testApp;
  const ids = [
    await inbox.notify({ title: 'a' }),
    await inbox.notify({ title: 'b' }),
    await inbox.notify({ title: 'c' }),
    await inbox.notify({ title: 'd' }),
  ];
  const [a, , , d] = ids;
  await inbox.http
    .put(`/notifications/${d}/position`)
    .send({ after: a })
    .expect(204);
  expect(await inbox.titles('notifications')).toEqual(['a', 'd', 'b', 'c']);
  await inbox.http
    .put(`/notifications/${a}/position`)
    .send({ before: ids[2] })
    .expect(204);
  expect(await inbox.titles('notifications')).toEqual(['d', 'b', 'a', 'c']);
  await inbox.http
    .put(`/notifications/${ids[2]}/position`)
    .send({ before: d })
    .expect(204);
  await inbox.notify({ title: 'e' });
  expect(await inbox.titles('notifications')).toEqual([
    'c',
    'd',
    'b',
    'a',
    'e',
  ]);
});

it('tells the app about every change, also when the counts stay', async () => {
  const { inbox } = testApp;
  const [first, second] = [await inbox.notify(), await inbox.notify()];
  const stream = await EventStream.open(testApp.app, '/inbox/events');
  await stream.until('id: 1\n');
  await inbox.http
    .put(`/notifications/${second}/position`)
    .send({ before: first })
    .expect(204);
  await stream.until('id: 2\n');
  stream.close();
});

it('moves a notification right above its neighbour when several lie above', async () => {
  const { inbox } = testApp;
  const ids = await inbox.each('notifications', ['a', 'b', 'c', 'd', 'e']);
  await inbox.http
    .put(`/notifications/${ids[4]}/position`)
    .send({ before: ids[3] })
    .expect(204);
  expect(await inbox.titles('notifications')).toEqual([
    'a',
    'b',
    'c',
    'e',
    'd',
  ]);
});
