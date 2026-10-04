import type { SessionConfigOption } from '@agentclientprotocol/sdk';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import type { AgentUpdate } from '../agent/agent-updates.js';
import type { SessionHandle } from '../agent/agent-session.js';
import type { InteractionEvent } from '../agent/interactions.js';
import type { PromptContent } from '../agent/session-content.js';
import { ScriptedTurn } from './scripted-turn.js';

export class FakeSession implements SessionHandle {
  readonly updates = new ReplaySubject<AgentUpdate>();
  readonly interactions = new Subject<InteractionEvent>();
  readonly configOptions = new BehaviorSubject<SessionConfigOption[]>([]);
  readonly turns: ScriptedTurn[] = [];
  readonly prompts: PromptContent[] = [];
  readonly steer = vi.fn<SessionHandle['steer']>(async () => true);
  readonly cancel = vi.fn<SessionHandle['cancel']>(async () => undefined);
  readonly respond = vi.fn<SessionHandle['respond']>(() => 'answered');
  readonly setConfigOption = vi.fn<SessionHandle['setConfigOption']>(
    async () => [],
  );
  readonly close = vi.fn<SessionHandle['close']>(async () => undefined);

  constructor(
    readonly id = 's1',
    readonly cwd = '/work',
  ) {}

  get latest(): ScriptedTurn {
    const turn = this.turns.at(-1);
    if (!turn) throw new Error('No turn started');
    return turn;
  }

  startTurn(content: PromptContent): ScriptedTurn {
    const turn = new ScriptedTurn();
    this.prompts.push(content);
    this.turns.push(turn);
    return turn;
  }

  emit(update: AgentUpdate['update'], sessionId = this.id): void {
    this.updates.next({ sessionId, update });
  }
}
