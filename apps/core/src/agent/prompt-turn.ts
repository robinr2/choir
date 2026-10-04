import type { PromptResponse, SessionUpdate } from '@agentclientprotocol/sdk';
import { type Observable, ReplaySubject } from 'rxjs';

export type AgentTurn = {
  readonly updates: Observable<SessionUpdate>;
  readonly result: Promise<PromptResponse | undefined>;
  cancel(): Promise<void>;
};

export class PromptTurn implements AgentTurn {
  private readonly stream = new ReplaySubject<SessionUpdate>();
  private readonly ended = Promise.withResolvers<PromptResponse | undefined>();
  private state: 'queued' | 'running' | 'ended' = 'queued';

  constructor(private readonly interrupt: () => Promise<void>) {
    this.ended.promise.catch(() => undefined);
  }

  get updates(): Observable<SessionUpdate> {
    return this.stream.asObservable();
  }

  get result(): Promise<PromptResponse | undefined> {
    return this.ended.promise;
  }

  start(): boolean {
    if (this.state !== 'queued') return false;
    this.state = 'running';
    return true;
  }

  push(update: SessionUpdate): void {
    this.stream.next(update);
  }

  end(response?: PromptResponse): void {
    this.state = 'ended';
    this.stream.complete();
    this.ended.resolve(response);
  }

  fail(error: unknown): void {
    this.state = 'ended';
    this.stream.error(error);
    this.ended.reject(error);
  }

  async cancel(): Promise<void> {
    if (this.state === 'queued') this.end();
    if (this.state === 'running') await this.interrupt();
  }
}
