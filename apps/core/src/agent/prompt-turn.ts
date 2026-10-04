import type { PromptResponse, SessionUpdate } from '@agentclientprotocol/sdk';
import { type Observable, ReplaySubject } from 'rxjs';

export type AgentTurn = {
  readonly updates: Observable<SessionUpdate>;
  readonly result: Promise<PromptResponse>;
  cancel(): Promise<void>;
};

export class PromptTurn implements AgentTurn {
  private readonly stream = new ReplaySubject<SessionUpdate>();
  private readonly ended = Promise.withResolvers<PromptResponse>();
  private running = true;

  constructor(private readonly interrupt: () => Promise<void>) {
    this.ended.promise.catch(() => undefined);
  }

  get updates(): Observable<SessionUpdate> {
    return this.stream.asObservable();
  }

  get result(): Promise<PromptResponse> {
    return this.ended.promise;
  }

  push(update: SessionUpdate): void {
    this.stream.next(update);
  }

  end(response: PromptResponse): void {
    this.running = false;
    this.stream.complete();
    this.ended.resolve(response);
  }

  fail(error: unknown): void {
    this.running = false;
    this.stream.error(error);
    this.ended.reject(error);
  }

  async cancel(): Promise<void> {
    if (this.running) await this.interrupt();
  }
}
