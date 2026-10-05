import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type MessageEvent } from '@nestjs/common';
import {
  defer,
  finalize,
  map,
  merge,
  type Observable,
  of,
  Subject,
  Subscription,
} from 'rxjs';
import {
  CONVERSATIONS,
  type Conversations,
} from '../conversations/conversations.port.js';
import { InboxCountsService } from '../inbox/inbox-counts.js';
import { RateLimitsService } from '../rate-limits/rate-limits.service.js';
import { WORKSPACE, type Workspace } from './workspace.port.js';

type Connection = {
  states: Subject<MessageEvent>;
  watched: Map<string, Subscription>;
};

function tagged(type: string, changes: Observable<object>) {
  return changes.pipe(map((data): MessageEvent => ({ type, data })));
}

@Injectable()
export class EventsService {
  private readonly connections = new Map<string, Connection>();

  constructor(
    @Inject(WORKSPACE) private readonly workspace: Pick<Workspace, 'changes'>,
    @Inject(InboxCountsService)
    private readonly inbox: Pick<InboxCountsService, 'changes'>,
    @Inject(RateLimitsService)
    private readonly rateLimits: Pick<RateLimitsService, 'changes'>,
    @Inject(CONVERSATIONS)
    private readonly conversations: Pick<Conversations, 'changes'>,
  ) {}

  stream(): Observable<MessageEvent> {
    return defer(() => {
      const id = randomUUID();
      const connection = {
        states: new Subject<MessageEvent>(),
        watched: new Map<string, Subscription>(),
      };
      this.connections.set(id, connection);
      return merge(
        of({ type: 'connection', data: { id } }),
        tagged('workspace', this.workspace.changes),
        tagged('inbox', this.inbox.changes),
        tagged('rate-limits', this.rateLimits.changes),
        connection.states,
      ).pipe(finalize(() => this.forget(id, connection)));
    });
  }

  watch(connection: string, conversation: string): boolean {
    const found = this.connections.get(connection);
    if (!found) return false;
    const { states, watched } = found;
    if (watched.has(conversation)) return true;
    const watch = new Subscription();
    watched.set(conversation, watch);
    watch.add(
      this.conversations.changes(conversation).subscribe({
        next: (state) =>
          states.next({
            type: 'conversation',
            data: { id: conversation, state },
          }),
        error: () => watched.delete(conversation),
      }),
    );
    return true;
  }

  unwatch(connection: string, conversation: string): boolean {
    const found = this.connections.get(connection);
    if (!found) return false;
    found.watched.get(conversation)?.unsubscribe();
    found.watched.delete(conversation);
    return true;
  }

  private forget(id: string, { watched }: Connection): void {
    for (const watch of watched.values()) watch.unsubscribe();
    this.connections.delete(id);
  }
}
