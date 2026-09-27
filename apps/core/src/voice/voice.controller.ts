import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { VoiceService } from './voice.service.js';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.voice.events().pipe(map((data) => ({ data })));
  }
}
