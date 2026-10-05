import type { ExternalStoreAdapter } from '@assistant-ui/react';
import type {
  Answer,
  CoreConversation,
} from '@/conversation/core-conversation';

type Answering = Required<
  Pick<ExternalStoreAdapter, 'onRespondToToolApproval' | 'onResumeToolCall'>
>;

type QuestionReply = { id: string; answer: Answer };

function isQuestionReply(payload: unknown): payload is QuestionReply {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'id' in payload &&
    'answer' in payload
  );
}

export function chatAnswersOf(conversation: CoreConversation): Answering {
  return {
    onRespondToToolApproval: async ({ approvalId, optionId }) => {
      if (optionId === undefined) {
        throw new Error('Choose one of the options the agent offers');
      }
      await conversation.answer(approvalId, { optionId });
    },
    onResumeToolCall: ({ payload }) => {
      if (!isQuestionReply(payload)) {
        throw new Error('Answer the questions with a question reply');
      }
      void conversation.answer(payload.id, payload.answer);
    },
  };
}
