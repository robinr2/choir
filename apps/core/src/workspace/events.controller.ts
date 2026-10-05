import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  type MessageEvent,
  NotFoundException,
  Param,
  Put,
  Sse,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { conversationIdSchema } from '../conversations/conversations.schemas.js';
import { EventsService } from './events.service.js';

const ID = { schema: conversationIdSchema };

function found(known: boolean, connection: string): void {
  if (!known) {
    throw new NotFoundException(`There is no event stream ${connection}`);
  }
}

@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Sse()
  stream(): Observable<MessageEvent> {
    return this.events.stream();
  }

  @Put(':connection/conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  watch(
    @Param('connection', ID) connection: string,
    @Param('id', ID) id: string,
  ): void {
    found(this.events.watch(connection, id), connection);
  }

  @Delete(':connection/conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unwatch(
    @Param('connection', ID) connection: string,
    @Param('id', ID) id: string,
  ): void {
    found(this.events.unwatch(connection, id), connection);
  }
}
