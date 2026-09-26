import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ThreadMessage,
} from '@assistant-ui/react';
import { EventSourceParserStream } from 'eventsource-parser/stream';

const USER_TURNS_URL = '/conversation/user-turns';

type ReplyChunk = { text: string };

function latestUserWords(messages: readonly ThreadMessage[]): string {
  const latest = messages.findLast((message) => message.role === 'user');
  return (latest?.content ?? [])
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}

async function* replyChunks(
  body: ReadableStream<BufferSource>,
): AsyncGenerator<string> {
  const events = body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream());
  for await (const { data } of events) {
    const chunk: ReplyChunk = JSON.parse(data);
    yield chunk.text;
  }
}

async function addUserTurn(
  text: string,
  signal: AbortSignal,
): Promise<ReadableStream<BufferSource>> {
  const response = await fetch(USER_TURNS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`The conversation replied with status ${response.status}`);
  }
  return response.body;
}

export async function* runCoreConversation({
  messages,
  abortSignal,
}: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
  const body = await addUserTurn(latestUserWords(messages), abortSignal);
  let text = '';
  for await (const chunk of replyChunks(body)) {
    text += chunk;
    yield { content: [{ type: 'text', text }] };
  }
}

export const coreConversationAdapter: ChatModelAdapter = {
  run: runCoreConversation,
};
