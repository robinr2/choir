import { ConversationService } from './conversation.service.js';

describe('ConversationService', () => {
  let conversation: ConversationService;

  beforeEach(() => {
    conversation = new ConversationService();
  });

  function exchange(text: string): void {
    conversation.add({ role: 'user', text });
    conversation.add({ role: 'assistant', text });
  }

  it('starts empty and keeps every message in order', () => {
    expect(conversation.history()).toEqual([]);
    exchange('hello');
    expect(conversation.history()).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'hello' },
    ]);
  });

  it('withdraws the latest user turn together with its reply', () => {
    exchange('first');
    exchange('second');
    conversation.withdrawLatestUserTurn();
    expect(conversation.history()).toEqual([
      { role: 'user', text: 'first' },
      { role: 'assistant', text: 'first' },
    ]);
    conversation.withdrawLatestUserTurn();
    expect(conversation.history()).toEqual([]);
  });

  it('withdraws nothing when the user has not spoken', () => {
    conversation.add({ role: 'assistant', text: 'welcome' });
    conversation.withdrawLatestUserTurn();
    expect(conversation.history()).toEqual([
      { role: 'assistant', text: 'welcome' },
    ]);
  });

  it('cuts the latest reply down to what was heard', () => {
    exchange('hello choir');
    conversation.interruptLatestReply('hello');
    expect(conversation.history()).toEqual([
      { role: 'user', text: 'hello choir' },
      { role: 'assistant', text: 'hello', interrupted: true },
    ]);
  });

  it('interrupts nothing when no reply is the latest message', () => {
    conversation.interruptLatestReply('hello');
    conversation.add({ role: 'user', text: 'hello choir' });
    conversation.interruptLatestReply('hello');
    expect(conversation.history()).toEqual([
      { role: 'user', text: 'hello choir' },
    ]);
  });
});
