import { Module } from '@nestjs/common';
import { choirConfigProvider } from '../choir/choir-config.provider.js';
import { AgentService } from './agent.service.js';
import { ProfileService } from './profile.service.js';

@Module({
  providers: [choirConfigProvider, ProfileService, AgentService],
  exports: [AgentService, choirConfigProvider.provide],
})
export class AgentModule {}
