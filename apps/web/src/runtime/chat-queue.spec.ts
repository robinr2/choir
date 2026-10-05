import type { AppendMessage } from '@assistant-ui/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CoreConversation } from '@/conversation/core-conversation';
import { fakeCore } from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { chatQueueOf, turnOf } from './chat-queue';

const PNG = 'data:image/png;base64,iVBOR';

function message(
  content: AppendMessage['content'],
  attachments?: AppendMessage['attachments'],
): AppendMessage {
  return {
    role: 'user',
    content,
    attachments: attachments ?? [],
    parentId: null,
    sourceId: null,
    runConfig: undefined,
    metadata: { custom: {} },
    createdAt: new Date(0),
  };
}

const conversation = new CoreConversation('c1');
const onResume = vi.fn<(open: true) => void>();

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onResume.mockReset();
});

test('takes the text and the images of a message', () => {
  expect(
    turnOf(
      message(
        [
          { type: 'text', text: 'what is ' },
          { type: 'image', image: PNG },
          { type: 'text', text: 'this' },
        ],
        [
          {
            id: 'a1',
            type: 'image',
            name: 'shot.jpg',
            status: { type: 'complete' },
            content: [
              { type: 'image', image: 'data:image/jpeg;base64,/9j/\n4AA' },
              { type: 'image', image: 'https://example.com/x.png' },
              { type: 'image', image: 'blob:data:image/png;base64,x' },
              { type: 'text', text: '?' },
            ],
          },
        ],
      ),
    ),
  ).toEqual({
    text: 'what is this?',
    images: [
      { mimeType: 'image/png', data: 'iVBOR' },
      { mimeType: 'image/jpeg', data: '/9j/\n4AA' },
    ],
  });
  expect(turnOf(message([{ type: 'text', text: 'hi' }]))).toEqual({
    text: 'hi',
    images: [],
  });
});

test('shows the turns core queued', () => {
  const queue = chatQueueOf(
    conversation,
    [{ id: 'q1', text: 'next', images: 1 }],
    onResume,
  );
  expect(queue.items).toEqual([
    {
      id: 'q1',
      prompt: 'next',
      parts: [
        { type: 'text', text: 'next' },
        { type: 'file', filename: 'image', data: '', mimeType: 'image/*' },
      ],
    },
  ]);
  expect(queue.steerItems).toEqual([]);
});

test('queues, steers, unqueues and steers queued turns in core', async () => {
  const queue = chatQueueOf(conversation, [], onResume);
  queue.enqueue(message([{ type: 'text', text: 'later' }]));
  queue.steer(message([{ type: 'text', text: 'now' }]));
  queue.move('q1', { lane: 'steer', insertAfter: null });
  queue.remove('q2');
  await queue.submit(message([{ type: 'text', text: 'also' }]));
  await vi.waitFor(() =>
    expect(requests()).toEqual(
      expect.arrayContaining([
        ['/conversations/c1/user-turns', 'POST', { text: 'later', images: [] }],
        ['/conversations/c1/steerings', 'POST', { text: 'now', images: [] }],
        ['/conversations/c1/queue/q1/steering', 'POST', undefined],
        ['/conversations/c1/queue/q2', 'DELETE', undefined],
        ['/conversations/c1/user-turns', 'POST', { text: 'also', images: [] }],
      ]),
    ),
  );
  expect(requests()).toHaveLength(5);
  expect(onResume).not.toHaveBeenCalled();
});

test('keeps the order of queued turns and their text', () => {
  const queue = chatQueueOf(conversation, [], onResume);
  expect(() => queue.move('q1', { lane: 'queue' })).toThrow(
    new Error('Queued turns keep their order'),
  );
  expect(() => queue.move('q1', {})).toThrow(
    new Error('Queued turns keep their order'),
  );
  expect(() =>
    queue.edit('q1', message([{ type: 'text', text: 'x' }])),
  ).toThrow(new Error('Queued turns cannot be edited'));
  expect(requests()).toEqual([]);
});

test('opens the session picker for a resume without a session', async () => {
  const queue = chatQueueOf(conversation, [], onResume);
  await queue.submit(message([{ type: 'text', text: ' /resume ' }]));
  expect(onResume).toHaveBeenCalledExactlyOnceWith(true);
  expect(requests()).toEqual([]);
});
