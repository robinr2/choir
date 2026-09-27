import { BehaviorSubject, type Observable } from 'rxjs';

export class WorkingAgents {
  private readonly prompts = new Map<string, number>();
  private readonly working = new BehaviorSubject<ReadonlySet<string>>(
    new Set(),
  );

  get changes(): Observable<ReadonlySet<string>> {
    return this.working.asObservable();
  }

  follow(id: string, prompt: Promise<unknown>): void {
    this.count(id, 1);
    void prompt.then(() => this.count(id, -1));
  }

  forget(id: string): void {
    this.prompts.delete(id);
    this.publish();
  }

  private count(id: string, change: number): void {
    const open = (this.prompts.get(id) ?? 0) + change;
    if (open > 0) this.prompts.set(id, open);
    else this.prompts.delete(id);
    this.publish();
  }

  private publish(): void {
    this.working.next(new Set(this.prompts.keys()));
  }
}
