import {
  type AgentContext,
  type ContentBlock,
  methods,
  type PromptRequest,
  type PromptResponse,
  type StopReason,
} from '@agentclientprotocol/sdk';
import { commands, said, type Turn } from './mock-agent-commands.js';
import type { MockSessions, Session } from './mock-agent-sessions.js';
import { transcriptCommands } from './mock-agent-transcript.js';

export const UPDATE: string = methods.client.session.update;

const STOP_REASONS: StopReason[] = [
  'end_turn',
  'max_tokens',
  'max_turn_requests',
  'refusal',
  'cancelled',
];

type Steering = { sessionId: string; prompt: { text: string }[] };

type Behaviour = { respond?: string; stopReason: string };

function text(blocks: ContentBlock[]): string {
  return blocks.map((block) => ('text' in block ? block.text : '')).join('');
}

function stopReason({ stopReason: wanted }: Behaviour): StopReason {
  return STOP_REASONS.find((reason) => reason === wanted) ?? 'end_turn';
}

export class MockTurns {
  capabilities: unknown;

  constructor(
    private readonly sessions: MockSessions,
    private readonly behaviour: Behaviour,
  ) {}

  emitter(sessionId: string, client: AgentContext): Turn['emit'] {
    const record = this.recorder(sessionId, client);
    return (update) => record({ sessionId, update });
  }

  async prompt(
    { sessionId, prompt: blocks }: PromptRequest,
    client: AgentContext,
  ): Promise<PromptResponse> {
    const session = this.sessions.get(sessionId);
    session.held?.();
    const running = new AbortController();
    Object.assign(session, { running, prompt: blocks });
    await this.remember(sessionId, blocks);
    const turn = this.turn(session, sessionId, client, running.signal);
    return this.respond(text(blocks), turn)
      .catch((error: unknown) => {
        if (running.signal.aborted) return { stopReason: 'cancelled' as const };
        throw error;
      })
      .finally(() => {
        if (session.running === running) session.running = undefined;
      });
  }

  steer({ sessionId, prompt }: Steering, client: AgentContext): void {
    const session = this.sessions.get(sessionId);
    const steered = prompt.map((block) => block.text).join('');
    setTimeout(() => {
      session.updates.push({
        sessionId,
        update: {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'text', text: steered },
        },
      });
      void this.emitter(sessionId, client)(said(`steered: ${steered}`));
    }, 0);
  }

  private turn(
    session: Session,
    sessionId: string,
    client: AgentContext,
    signal: AbortSignal,
  ): Turn {
    const emit = this.emitter(sessionId, client);
    const record = this.recorder(sessionId, client);
    const { capabilities } = this;
    return { sessionId, session, client, emit, record, signal, capabilities };
  }

  private recorder(sessionId: string, client: AgentContext): Turn['record'] {
    return async (notification) => {
      this.sessions.get(sessionId).updates.push(notification);
      await this.sessions.save(sessionId);
      await client.notify(UPDATE, notification);
    };
  }

  private async remember(sessionId: string, blocks: ContentBlock[]) {
    this.sessions.get(sessionId).updates.push(
      ...blocks.map((content) => ({
        sessionId,
        update: { sessionUpdate: 'user_message_chunk' as const, content },
      })),
    );
    await this.sessions.save(sessionId);
  }

  private async respond(words: string, turn: Turn): Promise<PromptResponse> {
    const [name = '', ...rest] = (this.behaviour.respond ?? words).split(' ');
    const command = commands[name] ?? transcriptCommands[name];
    if (command) await command(rest, turn);
    else await turn.emit(said(`unrecognized prompt: ${words}`));
    return { stopReason: stopReason(this.behaviour) };
  }
}
