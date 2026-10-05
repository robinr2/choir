import type { ContentBlock } from '@agentclientprotocol/sdk';
import type { AgentUpdate } from '../agent/agent-updates.js';
import {
  contentPart,
  upsertPart,
  withPart,
  withReply,
  withUserContent,
} from './session-messages.js';
import {
  withinSubagent,
  withSpawned,
  withSubagentState,
} from './subagent-parts.js';
import {
  isToolCall,
  toolCallPart,
  withToolCallUpdate,
} from './tool-call-part.js';
import type {
  CompactionPart,
  TranscriptMessage,
  TranscriptPart,
} from './transcript.js';

type Messages = TranscriptMessage[];

type Update = AgentUpdate['update'];

type Kind = Update['sessionUpdate'];

type Context = { at: number; nested: boolean };

type Updates = { [K in Kind]: Extract<Update, { sessionUpdate: K }> };

type Reducers = {
  [K in Kind]?: (
    messages: Messages,
    update: Updates[K],
    context: Context,
  ) => Messages;
};

function textOf(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
}

function isCompaction(id: string) {
  return (part: TranscriptPart): part is CompactionPart =>
    part.type === 'compaction' && part.id === id;
}

function compaction(id: string): () => CompactionPart {
  return () => ({ type: 'compaction', id, status: 'in_progress', summary: '' });
}

function said(messages: Messages, parts: TranscriptPart[]): Messages {
  return withReply(messages, (previous) => parts.reduce(withPart, previous));
}

const REDUCERS: Reducers = {
  user_message_chunk: (messages, { content }, { nested }) =>
    nested ? messages : withUserContent(messages, content),
  agent_message_chunk: (messages, { content }) =>
    said(messages, contentPart(content)),
  agent_thought_chunk: (messages, { content }) =>
    said(messages, [{ type: 'reasoning', text: textOf([content]) }]),
  tool_call: (messages, update, { at }) =>
    upsertPart(
      messages,
      isToolCall(update.toolCallId),
      (part) => withToolCallUpdate(part, update, at),
      () => toolCallPart(update.toolCallId, at),
    ),
  tool_call_update: (messages, update, { at }) =>
    upsertPart(
      messages,
      isToolCall(update.toolCallId),
      (part) => withToolCallUpdate(part, update, at),
      () => undefined,
    ),
  compaction_update: (messages, { compactionId, status, summary }) =>
    upsertPart(
      messages,
      isCompaction(compactionId),
      (part) => ({
        ...part,
        status,
        ...(summary && { summary: textOf(summary) }),
      }),
      compaction(compactionId),
    ),
  compaction_summary_chunk: (messages, { compactionId, content }) =>
    upsertPart(
      messages,
      isCompaction(compactionId),
      (part) => ({ ...part, summary: part.summary + textOf([content]) }),
      compaction(compactionId),
    ),
  subagent_spawned: (messages, update, { at }) =>
    withSpawned(messages, update, at),
  subagent_state_update: (messages, update, { at }) =>
    withSubagentState(messages, update, at),
};

function reduced<K extends Kind>(
  messages: Messages,
  kind: K,
  update: Updates[K],
  context: Context,
): Messages {
  const reducer = REDUCERS[kind];
  return reducer ? reducer(messages, update, context) : messages;
}

function withSessionUpdate(
  messages: Messages,
  update: Update,
  context: Context,
): Messages {
  return reduced(messages, update.sessionUpdate, update, context);
}

export function withinSession(
  messages: Messages,
  { root, sessionId }: { root: string; sessionId: string },
  change: (messages: Messages) => Messages,
): Messages {
  if (sessionId === root) return change(messages);
  return withinSubagent(messages, sessionId, change);
}

export function withAgentUpdate(
  messages: Messages,
  root: string,
  { sessionId, update }: AgentUpdate,
  at: number,
): Messages {
  const nested = sessionId !== root;
  return withinSession(messages, { root, sessionId }, (session) =>
    withSessionUpdate(session, update, { at, nested }),
  );
}
