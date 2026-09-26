import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  RequestMethod,
  Sse,
} from '@nestjs/common';
import {
  type Interruption,
  interruptionSchema,
  type UserTurn,
  userTurnSchema,
} from './conversation.schemas.js';
import { ConversationService } from './conversation.service.js';
import { EchoService } from './echo.service.js';

@Controller('conversation')
export class ConversationController {
  constructor(
    private readonly conversation: ConversationService,
    private readonly echo: EchoService,
  ) {}

  @Get()
  history() {
    return this.conversation.history();
  }

  @Sse('user-turns', { method: RequestMethod.POST })
  addUserTurn(@Body({ schema: userTurnSchema }) { text }: UserTurn) {
    return this.echo.respond(text);
  }

  @Post('withdrawals')
  @HttpCode(HttpStatus.NO_CONTENT)
  withdraw() {
    this.conversation.withdrawLatestUserTurn();
  }

  @Post('interruptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  interrupt(@Body({ schema: interruptionSchema }) { heard }: Interruption) {
    this.conversation.interruptLatestReply(heard);
  }
}
