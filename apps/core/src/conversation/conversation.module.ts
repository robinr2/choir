import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller.js';
import { ConversationService } from './conversation.service.js';
import { EchoService } from './echo.service.js';

@Module({
  controllers: [ConversationController],
  providers: [ConversationService, EchoService],
})
export class ConversationModule {}
