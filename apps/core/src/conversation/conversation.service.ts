import { Injectable } from '@nestjs/common';

export type ConversationMessage = {
  role: 'user' | 'assistant';
  text: string;
  interrupted?: true;
};

@Injectable()
export class ConversationService {
  private readonly messages: ConversationMessage[] = [];

  history(): readonly ConversationMessage[] {
    return this.messages;
  }

  add(message: ConversationMessage): void {
    this.messages.push(message);
  }

  withdrawLatestUserTurn(): void {
    const index = this.messages.findLastIndex(({ role }) => role === 'user');
    if (index >= 0) {
      this.messages.splice(index);
    }
  }

  interruptLatestReply(heard: string): void {
    const index = this.messages.length - 1;
    if (this.messages[index]?.role === 'assistant') {
      this.messages[index] = {
        role: 'assistant',
        text: heard,
        interrupted: true,
      };
    }
  }
}
