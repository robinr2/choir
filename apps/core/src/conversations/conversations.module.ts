import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { TurnMarksService } from './turn-marks.service.js';

@Module({
  imports: [AgentModule, VoiceModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, TurnMarksService],
  exports: [ConversationsService, VoiceModule],
})
export class ConversationsModule {}
