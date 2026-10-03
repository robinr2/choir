import { Injectable } from '@nestjs/common';
import { type Observable, Subject } from 'rxjs';

@Injectable()
export class InboxEvents {
  private readonly changes = new Subject<void>();
  private readonly arrivals = new Subject<string>();

  get changed(): Observable<void> {
    return this.changes.asObservable();
  }

  get received(): Observable<string> {
    return this.arrivals.asObservable();
  }

  change(): void {
    this.changes.next();
  }

  receive(notificationId: string): void {
    this.arrivals.next(notificationId);
    this.changes.next();
  }
}
