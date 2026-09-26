import { LiveStore, send } from '@/lib/live-store';
import type { TranscriptMessage } from './transcript';

export type ConversationSnapshot = {
  messages: readonly TranscriptMessage[];
  running: boolean;
};

type ConversationEvent = { messages: TranscriptMessage[] };

export class CoreConversation extends LiveStore<ConversationSnapshot> {
  readonly id: string;

  constructor(id: string) {
    super(`/conversations/${id}/events`, { messages: [], running: false });
    this.id = id;
  }

  async send(text: string): Promise<void> {
    this.update({ running: true });
    try {
      const response = await send(
        'POST',
        `/conversations/${this.id}/user-turns`,
        { text },
      );
      await response.text();
    } finally {
      this.update({ running: false });
    }
  }

  protected receive(data: Partial<ConversationEvent> | null): void {
    if (data?.messages) this.update({ messages: data.messages });
  }
}
