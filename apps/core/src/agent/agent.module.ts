import { Module } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { ProfileService } from './profile.service.js';

@Module({
  providers: [ProfileService, AgentService],
  exports: [AgentService, ProfileService],
})
export class AgentModule {}
