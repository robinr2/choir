import { Injectable, type MessageEvent } from '@nestjs/common';
import { type Observable, of } from 'rxjs';
import { ConversationService } from './conversation.service.js';

@Injectable()
export class EchoService {
  constructor(private readonly conversation: ConversationService) {}

  respond(text: string): Observable<MessageEvent> {
    this.conversation.add({ role: 'user', text });
    this.conversation.add({ role: 'assistant', text });
    return of({ data: { text } });
  }
}
