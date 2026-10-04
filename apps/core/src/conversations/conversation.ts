import { type Observable, Subscription } from 'rxjs';
import {
  newModel,
  stateOf,
  statusState,
  withSession,
  withStatus,
} from './conversation-model.js';
import type { ConversationModel } from './conversation-state.js';
import { ConversationTurns, type TurnHost } from './conversation-turns.js';
import { ConversationView } from './conversation-view.js';
import type {
  ConfigChange,
  ConversationState,
  Fork,
  InteractionAnswer,
  Reply,
  TurnMark,
  TurnOutcome,
  TurnRequest,
} from './conversations.port.js';
import { type FeedHooks, SessionFeed } from './session-feed.js';

type Session = Awaited<ReturnType<TurnHost['session']>>;

export type ConversationHost = {
  open(id: string): Promise<Session>;
  close(session: Session): Promise<void>;
  catalog(): Promise<ConversationModel['catalog']>;
  loadMarks(id: string): Promise<Map<string, TurnMark>>;
  saveMarks(id: string, marks: ReadonlyMap<string, TurnMark>): Promise<void>;
  usage: FeedHooks['usage'];
  ended(id: string, outcome: TurnOutcome): void;
  follow(id: string, settled: Promise<void>): void;
};

const CONFIG_IDS = ['model', 'effort', 'mode'] as const;

export class Conversation {
  readonly turns: ConversationTurns;
  private readonly view = new ConversationView(newModel(Date.now()), stateOf);
  private readonly forks = new Subscription();
  private opening?: Promise<SessionFeed>;
  private feed?: SessionFeed;

  constructor(
    readonly id: string,
    private readonly host: ConversationHost,
  ) {
    this.turns = new ConversationTurns(this.view, {
      session: () => this.ready(),
      saveMark: (request) => this.saveMark(request),
      changed: () => this.refresh(),
      ended: (outcome) => host.ended(id, outcome),
      follow: (settled) => host.follow(id, settled),
    });
  }

  get changes(): Observable<ConversationState> {
    return this.view.changes;
  }

  get state(): ConversationState {
    return this.view.state;
  }

  async ready(): Promise<Session> {
    return (await this.opened()).session;
  }

  async respond(id: string, answer: InteractionAnswer): Promise<Reply> {
    return (await this.opened()).respond(id, answer);
  }

  async configure(change: ConfigChange): Promise<void> {
    const session = await this.ready();
    await CONFIG_IDS.reduce(async (previous, id) => {
      await previous;
      const value = change[id];
      if (value !== undefined) await session.setConfigOption(id, value);
    }, Promise.resolve());
  }

  async markHeard(request: TurnRequest | undefined, heard: string) {
    if (request?.mark.aloud) {
      await this.mark(request.prompt, { ...request.mark, heard });
    }
  }

  follow(forks: Observable<Fork>): void {
    this.forks.add(
      forks.subscribe((fork) =>
        this.view.change((model) => ({
          ...model,
          forks: [...model.forks.filter(({ id }) => id !== fork.id), fork],
        })),
      ),
    );
  }

  async switchTo(link: () => Promise<void>): Promise<void> {
    const session = await this.ready();
    this.feed?.close();
    this.feed = undefined;
    this.refresh();
    await this.host.close(session);
    await link();
    this.opening = this.start();
    await this.opening;
  }

  async close(): Promise<void> {
    this.forks.unsubscribe();
    this.feed?.close();
    this.view.complete();
    const feed = await this.opening?.catch(() => undefined);
    if (feed) await this.host.close(feed.session);
  }

  private opened(): Promise<SessionFeed> {
    this.opening ??= this.start();
    return this.opening;
  }

  private async start(): Promise<SessionFeed> {
    const session = await this.host.open(this.id);
    const marks = await this.host.loadMarks(this.id);
    this.view.change((model) => withSession(model, session, marks));
    const feed = new SessionFeed(session, this.view, {
      usage: (update) => this.host.usage(update),
      changed: () => this.refresh(),
      held: () => this.turns.held(),
    });
    this.feed = feed;
    this.refresh();
    void this.host
      .catalog()
      .then((catalog) => this.view.change((model) => ({ ...model, catalog })));
    return feed;
  }

  private refresh(): void {
    const state = statusState({
      open: this.feed !== undefined,
      waiting: (this.feed?.pending.size ?? 0) > 0,
      busy: this.turns.busy,
      failed: this.turns.failed,
    });
    this.view.change((model) => withStatus(model, state, Date.now()));
  }

  private async saveMark({ prompt, mark }: TurnRequest): Promise<void> {
    if (Object.keys(mark).length > 0) await this.mark(prompt, mark);
  }

  private async mark(prompt: string, mark: TurnMark): Promise<void> {
    const marks = new Map(this.view.current.marks).set(prompt, mark);
    this.view.change((model) => ({ ...model, marks }));
    await this.host.saveMarks(this.id, marks);
  }
}
