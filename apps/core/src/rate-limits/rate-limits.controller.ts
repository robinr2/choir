import { Controller, Get, type MessageEvent, Sse } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { RateLimitsService } from './rate-limits.service.js';

@Controller('rate-limits')
export class RateLimitsController {
  constructor(private readonly rateLimits: RateLimitsService) {}

  @Get()
  current() {
    return this.rateLimits.current;
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.rateLimits.changes.pipe(map((data) => ({ data })));
  }
}
