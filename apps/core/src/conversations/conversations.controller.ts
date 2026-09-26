import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  NotFoundException,
  Param,
  Post,
  RequestMethod,
  Sse,
} from '@nestjs/common';
import { from, map, type Observable, switchMap } from 'rxjs';
import {
  conversationIdSchema,
  type Interruption,
  interruptionSchema,
  type SubmittedPrompt,
  submittedPromptSchema,
  type UserTurn,
  userTurnSchema,
} from './conversations.schemas.js';
import { ConversationsService } from './conversations.service.js';

const ID = { schema: conversationIdSchema };

const DENIED = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      'The user had not finished speaking, so this answer was withdrawn.',
  },
};

@Controller('conversations/:id')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  messages(@Param('id', ID) id: string) {
    return this.conversations.messages(id);
  }

  @Sse('events')
  events(@Param('id', ID) id: string): Observable<MessageEvent> {
    return this.conversations
      .updates(id)
      .pipe(map((messages) => ({ data: { messages } })));
  }

  @Sse('user-turns', { method: RequestMethod.POST })
  addUserTurn(
    @Param('id', ID) id: string,
    @Body({ schema: userTurnSchema })
    { text, early = false, voice = false }: UserTurn,
  ): Observable<MessageEvent> {
    return from(
      this.conversations.addUserTurn(id, text, { early, voice }),
    ).pipe(
      switchMap((answer) => answer),
      map((chunk) => ({ data: { text: chunk } })),
    );
  }

  @Post('confirmations')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirm(@Param('id', ID) id: string): void {
    this.conversations.confirm(id);
  }

  @Post('withdrawals')
  @HttpCode(HttpStatus.NO_CONTENT)
  withdraw(@Param('id', ID) id: string): Promise<void> {
    return this.conversations.withdraw(id);
  }

  @Post('interruptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  interrupt(
    @Param('id', ID) id: string,
    @Body({ schema: interruptionSchema }) { heard }: Interruption,
  ): Promise<void> {
    return this.conversations.interrupt(id, heard);
  }

  @Post('voice-turns')
  @HttpCode(HttpStatus.NO_CONTENT)
  findVoiceTurn(
    @Param('id', ID) id: string,
    @Body({ schema: submittedPromptSchema }) { prompt }: SubmittedPrompt,
  ): void {
    if (!this.conversations.isVoiceTurn(id, prompt)) {
      throw new NotFoundException('The prompt is not from a voice turn');
    }
  }

  @Post('tool-calls')
  @HttpCode(HttpStatus.OK)
  async decideToolCall(@Param('id', ID) id: string): Promise<object> {
    const allowed = await this.conversations.toolCallAllowed(id);
    return allowed ? {} : DENIED;
  }
}
