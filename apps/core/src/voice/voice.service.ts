import { Injectable } from '@nestjs/common';
import {
  BehaviorSubject,
  defer,
  filter,
  finalize,
  map,
  merge,
  type Observable,
  Subject,
  takeUntil,
} from 'rxjs';

export type VoiceEvent =
  | { type: 'agent'; agentId: string | null }
  | { type: 'reply'; text: string }
  | { type: 'reply-end' };

@Injectable()
export class VoiceService {
  private readonly active = new BehaviorSubject<string | null>(null);
  private readonly replies = new Subject<VoiceEvent>();
  private owner?: object;

  get changes(): Observable<string | null> {
    return this.active.asObservable();
  }

  isActive(agentId: string): boolean {
    return this.active.value === agentId;
  }

  activate(agentId: string | null): void {
    if (agentId === null) this.owner = undefined;
    if (this.active.value !== agentId) this.active.next(agentId);
  }

  speak(agentId: string, answer: Observable<string>): void {
    const switched = this.active.pipe(filter((id) => id !== agentId));
    answer.pipe(takeUntil(switched)).subscribe({
      next: (text) => this.replies.next({ type: 'reply', text }),
      complete: () => {
        if (this.isActive(agentId)) this.replies.next({ type: 'reply-end' });
      },
    });
  }

  events(): Observable<VoiceEvent> {
    return defer(() => {
      const owner = {};
      this.owner = owner;
      const agents = this.active.pipe(
        map((agentId): VoiceEvent => ({ type: 'agent', agentId })),
      );
      return merge(agents, this.replies).pipe(
        finalize(() => {
          if (this.owner === owner) this.activate(null);
        }),
      );
    });
  }
}
