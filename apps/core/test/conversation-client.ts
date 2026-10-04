import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types.js';
import type { ConversationState } from '../src/conversations/conversation-state.js';
import type { TranscriptMessage } from '../src/conversations/transcript.js';

export class ConversationClient {
  constructor(
    private readonly app: INestApplication<App>,
    readonly id: string = randomUUID(),
  ) {}

  say(text: string, early = false): Promise<Response> {
    return Promise.resolve(
      this.post('user-turns', { text, ...(early && { early }) }),
    );
  }

  post(path: string, body: object = {}) {
    return this.send('post', path, body);
  }

  send(method: 'post' | 'put' | 'delete', path: string, body: object = {}) {
    const server = request(this.app.getHttpServer());
    return server[method](`/conversations/${this.id}/${path}`).send(body);
  }

  async until(
    check: (state: ConversationState) => boolean,
  ): Promise<ConversationState> {
    return vi.waitFor(
      async () => {
        const state = await this.state();
        if (!check(state)) throw new Error('The conversation is not there yet');
        return state;
      },
      { timeout: 20_000, interval: 50 },
    );
  }

  async state(): Promise<ConversationState> {
    const response = await request(this.app.getHttpServer())
      .get(`/conversations/${this.id}`)
      .expect(200);
    return response.body;
  }

  async messages(): Promise<TranscriptMessage[]> {
    return (await this.state()).messages;
  }

  async userTexts(): Promise<string[]> {
    const messages = await this.messages();
    return messages
      .filter(({ role }) => role === 'user')
      .map(({ parts }) =>
        parts.map((part) => ('text' in part ? part.text : '')).join(''),
      );
  }

  async waitForAnswer(text: string): Promise<void> {
    await vi.waitFor(
      async () => {
        const last = (await this.messages()).at(-1);
        const said = last?.parts.some(
          (part) => part.type === 'text' && part.text === text,
        );
        if (!said) throw new Error(`The agent has not said "${text}" yet`);
      },
      { timeout: 20_000, interval: 100 },
    );
  }
}
