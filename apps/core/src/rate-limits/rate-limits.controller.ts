import { Controller, Get } from '@nestjs/common';
import { RateLimitsService } from './rate-limits.service.js';

@Controller('rate-limits')
export class RateLimitsController {
  constructor(private readonly rateLimits: RateLimitsService) {}

  @Get()
  current() {
    return this.rateLimits.current;
  }
}
