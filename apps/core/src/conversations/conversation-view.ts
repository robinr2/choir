import { BehaviorSubject, type Observable } from 'rxjs';
import type {
  ConversationModel,
  ConversationState,
} from './conversation-state.js';

type Render = (model: ConversationModel) => ConversationState;

export class ConversationView {
  private readonly states: BehaviorSubject<ConversationState>;

  constructor(
    private model: ConversationModel,
    private readonly render: Render,
  ) {
    this.states = new BehaviorSubject(render(model));
  }

  get current(): ConversationModel {
    return this.model;
  }

  get changes(): Observable<ConversationState> {
    return this.states.asObservable();
  }

  get state(): ConversationState {
    return this.states.value;
  }

  change(update: (model: ConversationModel) => ConversationModel): void {
    const changed = update(this.model);
    if (changed === this.model) return;
    this.model = changed;
    this.states.next(this.render(changed));
  }

  complete(): void {
    this.states.complete();
  }
}
