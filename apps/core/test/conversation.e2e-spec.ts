import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createApp } from './create-app.js';

let app: INestApplication<App>;

function post(path: string, body: object = {}) {
  return request(app.getHttpServer()).post(`/conversation/${path}`).send(body);
}

async function history() {
  const response = await request(app.getHttpServer())
    .get('/conversation')
    .expect(200);
  return response.body;
}

beforeEach(async () => {
  app = await createApp();
});

afterEach(async () => {
  await app.close();
});

it('/conversation/user-turns (POST) streams the echo as server-sent events', async () => {
  const response = await post('user-turns', { text: 'hello choir' });
  expect(response.headers['content-type']).toMatch(/^text\/event-stream/);
  expect(response.text).toContain('data: {"text":"hello choir"}\n\n');
  expect(await history()).toEqual([
    { role: 'user', text: 'hello choir' },
    { role: 'assistant', text: 'hello choir' },
  ]);
});

it('/conversation/user-turns (POST) rejects a turn without words', async () => {
  await post('user-turns', { text: '  ' }).expect(400);
});

it('/conversation/withdrawals (POST) forgets the latest user turn', async () => {
  await post('user-turns', { text: 'hello choir' });
  await post('withdrawals').expect(204);
  expect(await history()).toEqual([]);
});

it('/conversation/interruptions (POST) keeps only what was heard', async () => {
  await post('user-turns', { text: 'hello choir' });
  await post('interruptions', { heard: 'hello' }).expect(204);
  expect(await history()).toEqual([
    { role: 'user', text: 'hello choir' },
    { role: 'assistant', text: 'hello', interrupted: true },
  ]);
});

it('/conversation/interruptions (POST) rejects an interruption without what was heard', async () => {
  await post('interruptions').expect(400);
});
