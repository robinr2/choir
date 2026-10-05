import { Module } from '@nestjs/common';
import { RateLimitsController } from './rate-limits.controller.js';
import { RateLimitsService } from './rate-limits.service.js';

@Module({
  controllers: [RateLimitsController],
  providers: [RateLimitsService],
  exports: [RateLimitsService],
})
export class RateLimitsModule {}
