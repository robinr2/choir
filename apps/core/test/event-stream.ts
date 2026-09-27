import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { baseUrl } from './listening.js';

export class EventStream {
  private received = '';

  private constructor(
    private readonly reader: ReadableStreamDefaultReader<string>,
    private readonly abort: AbortController,
  ) {}

  static async open(
    app: INestApplication<App>,
    path: string,
  ): Promise<EventStream> {
    const abort = new AbortController();
    const response = await fetch(`${await baseUrl(app)}${path}`, {
      signal: abort.signal,
    });
    const reader = response.body
      ?.pipeThrough(new TextDecoderStream())
      .getReader();
    if (!reader) throw new Error(`${path} sent no events`);
    return new EventStream(reader, abort);
  }

  get text(): string {
    return this.received;
  }

  async until(text: string): Promise<string> {
    if (this.received.includes(text)) return this.received;
    const { value, done } = await this.reader.read();
    if (done) throw new Error(`The stream ended before "${text}"`);
    this.received += value;
    return this.until(text);
  }

  close(): void {
    this.abort.abort();
  }
}
