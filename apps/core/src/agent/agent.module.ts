import { Module } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { AgentSessionsStore } from './agent-sessions.store.js';
import { ProfileService } from './profile.service.js';

@Module({
  providers: [ProfileService, AgentSessionsStore, AgentService],
  exports: [AgentService, ProfileService],
})
export class AgentModule {}
