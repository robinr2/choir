import { Subscription } from 'rxjs';
import type { AgentUpdate } from '../agent/agent-updates.js';
import type { SessionHandle } from '../agent/agent-session.js';
import type { ModelStore } from './conversation-state.js';
import type {
  Interaction,
  InteractionAnswer,
  InteractionEvent,
  Reply,
  SessionUpdate,
} from './conversations.port.js';
import { withInteraction, withSettlement } from './interaction-parts.js';
import { holds, sessionUpdateOf, withReceived } from './model-updates.js';

export type FeedHooks = {
  usage(update: SessionUpdate): void;
  changed(): void;
  held(): void;
};

export class SessionFeed {
  readonly pending = new Set<string>();
  private readonly answered = new Set<string>();
  private readonly subscription = new Subscription();

  constructor(
    readonly session: SessionHandle,
    private readonly view: ModelStore,
    private readonly hooks: FeedHooks,
  ) {
    this.subscription.add(
      session.updates.subscribe((update) => this.receive(update)),
    );
    this.subscription.add(
      session.interactions.subscribe((event) => this.interact(event)),
    );
    this.subscription.add(
      session.configOptions.subscribe((options) =>
        view.change((model) => ({ ...model, options })),
      ),
    );
  }

  respond(id: string, answer: InteractionAnswer): Reply {
    const reply = this.session.respond(id, answer);
    if (reply === 'unknown' && this.answered.has(id)) return 'answered-before';
    return reply;
  }

  close(): void {
    this.subscription.unsubscribe();
  }

  private receive(received: AgentUpdate): void {
    const root = this.session.id;
    this.view.change((model) =>
      withReceived(model, root, received, Date.now()),
    );
    const update = sessionUpdateOf(received);
    if (update) this.hooks.usage(update);
    if (holds(this.view.current, root, received)) this.hooks.held();
  }

  private interact(event: InteractionEvent): void {
    if (event.type === 'requested') this.asked(event.interaction);
    if (event.type === 'settled') this.settled(event.id, event.answer);
    this.hooks.changed();
  }

  private asked(interaction: Interaction): void {
    const root = this.session.id;
    this.pending.add(interaction.id);
    this.view.change((model) => ({
      ...model,
      messages: withInteraction(model.messages, root, interaction, Date.now()),
    }));
  }

  private settled(id: string, answer: InteractionAnswer): void {
    this.pending.delete(id);
    this.answered.add(id);
    this.view.change((model) => ({
      ...model,
      messages: withSettlement(model.messages, id, answer),
    }));
  }
}
