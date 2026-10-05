import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import type {
  Answer,
  CoreConversation,
} from '@/conversation/core-conversation';

export type Answering = {
  choose: (approvalId: string, optionId: string) => void;
  reply: (questionId: string, answer: Answer) => void;
};

export function runtimeAnswering({
  respondToApproval,
  resume,
}: Pick<ToolCallMessagePartProps, 'respondToApproval' | 'resume'>): Answering {
  return {
    choose: (_approvalId, optionId) => void respondToApproval({ optionId }),
    reply: (id, answer) => resume({ id, answer }),
  };
}

export function directAnswering(conversation: CoreConversation): Answering {
  return {
    choose: (approvalId, optionId) =>
      void conversation.answer(approvalId, { optionId }),
    reply: (id, answer) => void conversation.answer(id, answer),
  };
}
