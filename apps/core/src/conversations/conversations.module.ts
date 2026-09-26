import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { VoiceTurnsService } from './voice-turns.service.js';

@Module({
  imports: [AgentModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, VoiceTurnsService],
})
export class ConversationsModule {}
