import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  type MessageEvent,
  NotFoundException,
  Param,
  Post,
  Put,
  RequestMethod,
  Sse,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { ConversationCommandsService } from './conversation-commands.service.js';
import type { ConversationState } from './conversation-state.js';
import {
  CONVERSATIONS,
  type Conversations,
  type Reply,
} from './conversations.port.js';
import {
  type Confirmation,
  confirmationSchema,
  conversationIdSchema,
  type InteractionAnswerRequest,
  interactionAnswerSchema,
  type Interruption,
  interruptionSchema,
  type SettingsRequest,
  settingsSchema,
  type Steering,
  steeringSchema,
  type SubmittedPrompt,
  submittedPromptSchema,
  type UserTurn,
  userTurnSchema,
} from './conversations.schemas.js';

const ID = { schema: conversationIdSchema };

const DENIED = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason:
      'The user had not finished speaking, so this answer was withdrawn.',
  },
};

const REPLIES: Record<Exclude<Reply, 'answered'>, () => Error> = {
  unknown: () => new NotFoundException('There is no such question'),
  'answered-before': () => new ConflictException('It is answered already'),
  unfit: () => new BadRequestException('The answer does not fit the question'),
};

function found(done: boolean, item: string): void {
  if (!done) throw new NotFoundException(`There is no queued message ${item}`);
}

@Controller('conversations/:id')
export class ConversationsController {
  constructor(
    @Inject(CONVERSATIONS) private readonly conversations: Conversations,
    private readonly commands: ConversationCommandsService,
  ) {}

  @Get()
  state(@Param('id', ID) id: string): Promise<ConversationState> {
    return this.conversations.state(id);
  }

  @Sse('events')
  events(@Param('id', ID) id: string): Observable<MessageEvent> {
    return this.conversations.changes(id).pipe(map((data) => ({ data })));
  }

  @Sse('user-turns', { method: RequestMethod.POST })
  async addUserTurn(
    @Param('id', ID) id: string,
    @Body({ schema: userTurnSchema })
    { text, images, early = false, voice = false }: UserTurn,
  ): Promise<Observable<MessageEvent>> {
    const answer = await this.commands.addUserTurn(
      id,
      { text, images },
      { early, voice },
    );
    return answer.pipe(map((chunk) => ({ data: { text: chunk } })));
  }

  @Post('steerings')
  @HttpCode(HttpStatus.NO_CONTENT)
  steer(
    @Param('id', ID) id: string,
    @Body({ schema: steeringSchema }) content: Steering,
  ): Promise<void> {
    return this.conversations.steer(id, content);
  }

  @Delete('queue/:item')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ID) id: string, @Param('item', ID) item: string): void {
    found(this.conversations.removeQueued(id, item), item);
  }

  @Post('queue/:item/steering')
  @HttpCode(HttpStatus.NO_CONTENT)
  async steerQueued(
    @Param('id', ID) id: string,
    @Param('item', ID) item: string,
  ): Promise<void> {
    found(await this.conversations.steerQueued(id, item), item);
  }

  @Post('cancellation')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('id', ID) id: string): Promise<void> {
    return this.conversations.cancel(id);
  }

  @Post('interactions/:interaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  async respond(
    @Param('id', ID) id: string,
    @Param('interaction', ID) interaction: string,
    @Body({ schema: interactionAnswerSchema }) answer: InteractionAnswerRequest,
  ): Promise<void> {
    const reply = await this.conversations.respond(id, interaction, answer);
    if (reply !== 'answered') throw REPLIES[reply]();
  }

  @Put('settings')
  @HttpCode(HttpStatus.NO_CONTENT)
  configure(
    @Param('id', ID) id: string,
    @Body({ schema: settingsSchema }) settings: SettingsRequest,
  ): Promise<void> {
    return this.conversations.configure(id, settings);
  }

  @Post('confirmations')
  @HttpCode(HttpStatus.NO_CONTENT)
  confirm(
    @Param('id', ID) id: string,
    @Body({ schema: confirmationSchema }) { text }: Confirmation,
  ): void {
    this.conversations.confirm(id, text);
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

  @Post('prompt-contexts')
  @HttpCode(HttpStatus.OK)
  async promptContext(
    @Param('id', ID) id: string,
    @Body({ schema: submittedPromptSchema }) { prompt }: SubmittedPrompt,
  ): Promise<object> {
    const additionalContext = await this.conversations.promptContext(
      id,
      prompt,
    );
    if (!additionalContext) return {};
    return {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext,
      },
    };
  }

  @Post('tool-calls')
  @HttpCode(HttpStatus.OK)
  async decideToolCall(@Param('id', ID) id: string): Promise<object> {
    const allowed = await this.conversations.toolCallAllowed(id);
    return allowed ? {} : DENIED;
  }
}
