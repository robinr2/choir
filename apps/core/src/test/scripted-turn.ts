import type { PromptResponse, SessionUpdate } from '@agentclientprotocol/sdk';
import { ReplaySubject } from 'rxjs';
import type { AgentTurn } from '../agent/prompt-turn.js';

export class ScriptedTurn implements AgentTurn {
  readonly updates = new ReplaySubject<SessionUpdate>();
  readonly cancel = vi.fn<AgentTurn['cancel']>(async () =>
    this.end({ stopReason: 'cancelled' }),
  );
  private readonly finished = Promise.withResolvers<PromptResponse>();

  constructor() {
    this.finished.promise.catch(() => undefined);
  }

  get result(): Promise<PromptResponse> {
    return this.finished.promise;
  }

  says(text: string): void {
    this.updates.next({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text },
    });
  }

  end(response: PromptResponse = { stopReason: 'end_turn' }): void {
    this.finished.resolve(response);
    this.updates.complete();
  }

  fail(error: Error): void {
    this.finished.reject(error);
    this.updates.error(error);
  }
}
