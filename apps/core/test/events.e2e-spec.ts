import request from 'supertest';
import { EventStream } from './event-stream.js';
import { TestApp } from './test-app.js';

const UNKNOWN = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const testApp = TestApp.use();

it('opens one stream for the page with its workspace, inbox and rate limits', async () => {
  const events = await EventStream.page(testApp.app);
  try {
    await events.until('event: connection\n');
    await events.until('event: workspace\n');
    await events.until('event: inbox\n');
    await events.until('event: rate-limits\n');
  } finally {
    events.close();
  }
});

it('watches conversations only on an open stream', async () => {
  const { app, conversation } = testApp;
  const http = () => request(app.getHttpServer());
  const events = await EventStream.page(app);
  const connection = await events.connection();
  const watched = `/events/${connection}/conversations/${conversation.id}`;
  const unknown = await http()
    .put(`/events/${UNKNOWN}/conversations/${conversation.id}`)
    .expect(404);
  expect(unknown.body.message).toBe(`There is no event stream ${UNKNOWN}`);
  await http()
    .delete(`/events/${UNKNOWN}/conversations/${conversation.id}`)
    .expect(404);
  await http().put(`/events/nope/conversations/${conversation.id}`).expect(400);
  await http().put(`/events/${connection}/conversations/nope`).expect(400);
  await http().put(watched).expect(204);
  events.close();
  await vi.waitFor(() => http().put(watched).expect(404));
});
