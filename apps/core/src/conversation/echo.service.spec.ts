import { lastValueFrom, toArray } from 'rxjs';
import { ConversationService } from './conversation.service.js';
import { EchoService } from './echo.service.js';

describe('EchoService', () => {
  it('keeps the user turn and its echo, and streams the echo', async () => {
    const conversation = new ConversationService();
    const echo = new EchoService(conversation);
    const events = await lastValueFrom(
      echo.respond('hello choir').pipe(toArray()),
    );
    expect(events).toEqual([{ data: { text: 'hello choir' } }]);
    expect(conversation.history()).toEqual([
      { role: 'user', text: 'hello choir' },
      { role: 'assistant', text: 'hello choir' },
    ]);
  });
});
