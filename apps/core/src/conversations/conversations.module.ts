import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { RateLimitsModule } from '../rate-limits/rate-limits.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { ConversationCommandsService } from './conversation-commands.service.js';
import { ConversationHostService } from './conversation-host.service.js';
import { ConversationsController } from './conversations.controller.js';
import {
  ConversationsService,
  conversationsProvider,
} from './conversations.service.js';

@Module({
  imports: [AgentModule, VoiceModule, RateLimitsModule],
  controllers: [ConversationsController],
  providers: [
    ConversationHostService,
    ConversationsService,
    ConversationCommandsService,
    conversationsProvider,
  ],
  exports: [conversationsProvider, VoiceModule],
})
export class ConversationsModule {}
