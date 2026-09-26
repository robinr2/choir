import type { ChatModelRunResult, ThreadMessage } from '@assistant-ui/react';
import { afterEach, expect, test, vi } from 'vitest';
import { runCoreConversation } from './core-conversation-adapter';

const createdAt = new Date('2026-01-01T00:00:00Z');

function userMessage(
  content: Extract<ThreadMessage, { role: 'user' }>['content'],
): ThreadMessage {
  return {
    id: 'user',
    createdAt,
    role: 'user',
    content,
    attachments: [],
    metadata: { custom: {} },
  };
}

const reply: ThreadMessage = {
  id: 'assistant',
  createdAt,
  role: 'assistant',
  content: [{ type: 'text', text: 'first' }],
  status: { type: 'complete', reason: 'stop' },
  metadata: {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: {},
  },
};

const conversation: ThreadMessage[] = [
  userMessage([{ type: 'text', text: 'first' }]),
  reply,
  userMessage([
    { type: 'text', text: 'hello ' },
    { type: 'image', image: 'data:image/png;base64,' },
    { type: 'text', text: 'choir' },
  ]),
];

function stream(...texts: string[]): Response {
  return new Response(
    texts.map((text) => `data: ${JSON.stringify({ text })}\n\n`).join(''),
  );
}

function respondWith(response: Response) {
  return vi.spyOn(window, 'fetch').mockResolvedValue(response);
}

async function run(
  messages = conversation,
  abortSignal = new AbortController().signal,
) {
  const results: ChatModelRunResult[] = [];
  const generator = runCoreConversation({
    messages,
    abortSignal,
    runConfig: {},
    context: {},
    unstable_getMessage: () => reply,
  });
  for await (const result of generator) {
    results.push(result);
  }
  return results;
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('hands the conversation only the words of the latest user turn', async () => {
  const fetch = respondWith(stream());
  const abortSignal = new AbortController().signal;
  await run(conversation, abortSignal);
  expect(fetch).toHaveBeenCalledWith('/conversation/user-turns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello choir' }),
    signal: abortSignal,
  });
});

test('hands the conversation no words when the user has not spoken', async () => {
  const fetch = respondWith(stream());
  await run([reply]);
  expect(fetch).toHaveBeenCalledWith(
    '/conversation/user-turns',
    expect.objectContaining({ body: JSON.stringify({ text: '' }) }),
  );
});

test('streams the reply as it grows', async () => {
  respondWith(stream('hello', ' choir'));
  const texts = (await run()).map((result) => result.content);
  expect(texts).toEqual([
    [{ type: 'text', text: 'hello' }],
    [{ type: 'text', text: 'hello choir' }],
  ]);
});

test('fails when the conversation rejects the turn', async () => {
  respondWith(new Response('', { status: 500 }));
  await expect(run()).rejects.toThrow(
    new Error('The conversation replied with status 500'),
  );
});

test('fails when the conversation answers without a body', async () => {
  respondWith(new Response(null, { status: 200 }));
  await expect(run()).rejects.toThrow(
    new Error('The conversation replied with status 200'),
  );
});
