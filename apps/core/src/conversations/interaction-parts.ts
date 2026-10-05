import type {
  PermissionOptionKind,
  RequestPermissionRequest,
} from '@agentclientprotocol/sdk';
import type { Interaction, InteractionAnswer } from '../agent/interactions.js';
import {
  type ElicitationRequest,
  elicitationPart,
  questionsOf,
  requestSchema,
} from './elicitation-schema.js';
import { upsertPart, withReply } from './session-messages.js';
import {
  isToolCall,
  toolCallPart,
  withToolCallUpdate,
} from './tool-call-part.js';
import type {
  Answers,
  Approval,
  ApprovalOption,
  Question,
  ToolCallPart,
  TranscriptMessage,
  TranscriptPart,
} from './transcript.js';
import { withinSession } from './transcript-updates.js';

type Messages = TranscriptMessage[];

const KINDS: Record<PermissionOptionKind, ApprovalOption['kind']> = {
  allow_once: 'allow-once',
  allow_always: 'allow-always',
  reject_once: 'reject-once',
  reject_always: 'reject-always',
};

const RESOLUTIONS = { decline: 'declined', cancel: 'cancelled' } as const;

const STATES = {
  accept: 'accepted',
  decline: 'declined',
  cancel: 'cancelled',
} as const;

function approvalOf(
  id: string,
  { toolCall, options }: RequestPermissionRequest,
): Approval {
  return {
    id,
    ...(toolCall.title && { prompt: toolCall.title }),
    options: options.map(({ optionId, kind, name }) => ({
      id: optionId,
      kind: KINDS[kind],
      label: name,
    })),
  };
}

function onToolCall(
  messages: Messages,
  toolCallId: string,
  change: (part: ToolCallPart) => ToolCallPart,
  at: number,
): Messages {
  return upsertPart(messages, isToolCall(toolCallId), change, () =>
    toolCallPart(toolCallId, at),
  );
}

function asked(
  messages: Messages,
  id: string,
  request: ElicitationRequest,
  at: number,
): Messages {
  const { toolCallId } = request;
  if (!toolCallId) {
    return withReply(messages, (parts) => [
      ...parts,
      elicitationPart(id, request),
    ]);
  }
  const question = { id, questions: questionsOf(request) };
  return onToolCall(
    messages,
    toolCallId,
    (part) => ({ ...part, question }),
    at,
  );
}

function ask(messages: Messages, interaction: Interaction, at: number) {
  if (interaction.kind === 'elicitation') {
    const request = requestSchema.parse(interaction.request);
    return asked(messages, interaction.id, request, at);
  }
  const { request } = interaction;
  const approval = approvalOf(interaction.id, request);
  return onToolCall(
    messages,
    request.toolCall.toolCallId,
    (part) => ({ ...withToolCallUpdate(part, request.toolCall, at), approval }),
    at,
  );
}

export function withInteraction(
  messages: Messages,
  root: string,
  interaction: Interaction,
  at: number,
): Messages {
  const { sessionId = root } = requestSchema
    .pick({ sessionId: true })
    .parse(interaction.request);
  return withinSession(messages, { root, sessionId }, (session) =>
    ask(session, interaction, at),
  );
}

function answers(answer: InteractionAnswer): Answers {
  if (!('content' in answer)) return {};
  return Object.fromEntries(
    Object.entries(answer.content ?? {}).flatMap(([key, value]) =>
      typeof value === 'string' || Array.isArray(value) ? [[key, value]] : [],
    ),
  );
}

function settledApproval(
  approval: Approval,
  answer: InteractionAnswer,
): Approval {
  if (!('optionId' in answer)) return { ...approval, resolution: 'cancelled' };
  const chosen = approval.options.find(({ id }) => id === answer.optionId);
  const approved = chosen?.kind.startsWith('allow') ?? false;
  return { ...approval, approved, optionId: answer.optionId };
}

function settledQuestion(
  question: Question,
  answer: InteractionAnswer,
): Question {
  if (!('action' in answer) || answer.action === 'accept') {
    return { ...question, answers: answers(answer) };
  }
  return { ...question, resolution: RESOLUTIONS[answer.action] };
}

function approvalAnswered(
  part: ToolCallPart,
  id: string,
  answer: InteractionAnswer,
): ToolCallPart {
  const { approval } = part;
  if (approval?.id !== id) return part;
  return { ...part, approval: settledApproval(approval, answer) };
}

function questionAnswered(
  part: ToolCallPart,
  id: string,
  answer: InteractionAnswer,
): ToolCallPart {
  const { question } = part;
  if (question?.id !== id) return part;
  return { ...part, question: settledQuestion(question, answer) };
}

function settledCall(
  part: ToolCallPart,
  id: string,
  answer: InteractionAnswer,
): ToolCallPart {
  const answered = questionAnswered(
    approvalAnswered(part, id, answer),
    id,
    answer,
  );
  const { messages } = answered;
  if (!messages) return answered;
  return { ...answered, messages: withSettlement(messages, id, answer) };
}

function settled(
  part: TranscriptPart,
  id: string,
  answer: InteractionAnswer,
): TranscriptPart {
  if (part.type === 'tool-call') return settledCall(part, id, answer);
  if (part.type !== 'elicitation' || part.id !== id) return part;
  return 'action' in answer ? { ...part, state: STATES[answer.action] } : part;
}

export function withSettlement(
  messages: Messages,
  id: string,
  answer: InteractionAnswer,
): Messages {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => settled(part, id, answer)),
  }));
}
