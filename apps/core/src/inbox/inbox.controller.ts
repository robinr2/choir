import { Controller, Inject, type MessageEvent, Sse } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { InboxCountsService } from './inbox-counts.js';

@Controller('inbox')
export class InboxController {
  constructor(
    @Inject(InboxCountsService) private readonly counts: InboxCountsService,
  ) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.counts.changes.pipe(map((data) => ({ data })));
  }
}
