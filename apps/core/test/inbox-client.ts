import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';

export const CLOUDEVENTS = 'application/cloudevents+json';

type Data = {
  title?: string;
  text?: string;
  link?: string;
  attachments?: {
    filename: string;
    mediaType: string;
    contentBase64: string;
  }[];
};

export function notificationEvent(data: Data = {}, event: object = {}) {
  return {
    specversion: '1.0',
    id: randomUUID(),
    source: 'outlook',
    type: 'choir.notification.v1',
    time: '2026-09-28T08:14:03+02:00',
    ...event,
    data: {
      title: 'Production is down',
      text: 'Please check the logs.',
      ...data,
    },
  };
}

export class InboxClient {
  constructor(private readonly app: INestApplication<App>) {}

  get http() {
    return request(this.app.getHttpServer());
  }

  push(event: object) {
    return this.http
      .post('/notifications')
      .set('Content-Type', CLOUDEVENTS)
      .send(event);
  }

  async notify(data: Data = {}, event: object = {}): Promise<string> {
    const response = await this.push(notificationEvent(data, event)).expect(
      201,
    );
    return response.body.id;
  }

  async list(
    kind: 'notifications' | 'todos',
    query: Record<string, string> = {},
  ) {
    return (await this.http.get(`/${kind}`).query(query).expect(200)).body;
  }

  async titles(
    kind: 'notifications' | 'todos',
    query: Record<string, string> = {},
  ) {
    const entries: { title: string }[] = await this.list(kind, query);
    return entries.map(({ title }) => title);
  }

  async each(
    kind: 'notifications' | 'todos',
    [title, ...rest]: string[],
  ): Promise<string[]> {
    if (title === undefined) return [];
    const id =
      kind === 'todos'
        ? await this.todo({ title })
        : await this.notify({ title });
    return [id, ...(await this.each(kind, rest))];
  }

  async todo(body: object): Promise<string> {
    return (await this.http.post('/todos').send(body).expect(201)).body.id;
  }
}
