import { expect, test } from 'vitest';
import { toolCall } from '@/test/fake-core';
import { threadMessageOf, toolDetailsIn } from './thread-message';
import { type Approval, type ElicitationPart, isSpokenIn } from './transcript';

const ELICITATION: ElicitationPart = {
  type: 'elicitation',
  id: 'e1',
  server: null,
  message: 'Pick one',
  mode: 'form',
  fields: [],
  state: 'request',
};

const COMPACTION = {
  type: 'compaction',
  id: 'c1',
  status: 'completed',
  summary: 'We talked.',
} as const;

const QUESTION = {
  id: 'i2',
  questions: [
    {
      id: 'question_0',
      header: 'Color',
      prompt: 'Which color?',
      options: [{ id: 'red', label: 'Red' }],
      multiple: false,
      freeform: null,
    },
  ],
};

const APPROVAL: Approval = {
  id: 'i1',
  options: [{ id: 'allow', kind: 'allow-once', label: 'Yes' }],
};

const DIFF = { path: '/a.ts', oldText: 'a', newText: 'b' };

test('shows the text, thoughts, tool calls, forms and compactions of a reply', () => {
  expect(
    threadMessageOf({
      id: 'm1',
      role: 'assistant',
      parts: [
        toolCall(
          'tool-1',
          'Read',
          { filePath: 'notes.md' },
          {
            result: { content: 'buy milk' },
            isError: false,
            diffs: [DIFF],
            locations: [{ path: '/a.ts', line: 3 }],
            approval: APPROVAL,
          },
        ),
        toolCall('tool-2', 'Bash', undefined, { status: 'in_progress' }),
        { type: 'reasoning', text: 'hmm' },
        ELICITATION,
        COMPACTION,
        { type: 'text', text: 'Done.' },
      ],
    }),
  ).toEqual({
    id: 'm1',
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'Read',
        args: { filePath: 'notes.md' },
        argsText: '{"filePath":"notes.md"}',
        result: { content: 'buy milk' },
        isError: false,
        timing: { startedAt: 0 },
        artifact: {
          kind: 'read',
          status: 'completed',
          diffs: [DIFF],
          locations: [{ path: '/a.ts', line: 3 }],
          question: undefined,
        },
        approval: APPROVAL,
      },
      {
        type: 'tool-call',
        toolCallId: 'tool-2',
        toolName: 'Bash',
        args: {},
        argsText: '{}',
        result: undefined,
        isError: undefined,
        timing: { startedAt: 0 },
        artifact: {
          kind: 'read',
          status: 'in_progress',
          diffs: [],
          locations: [],
          question: undefined,
        },
      },
      { type: 'reasoning', text: 'hmm' },
      { type: 'data', name: 'elicitation', data: ELICITATION },
      { type: 'data', name: 'compaction', data: COMPACTION },
      { type: 'text', text: 'Done.' },
    ],
    metadata: { custom: {} },
  });
});

function contentOf(...parts: Parameters<typeof toolCall>) {
  return threadMessageOf({
    id: 'm1',
    role: 'assistant',
    parts: [toolCall(...parts)],
  }).content[0];
}

test('settles finished tool calls even when they returned nothing', () => {
  expect(contentOf('t', 'Edit', ['x'], { status: 'failed' })).toMatchObject({
    args: {},
    argsText: '["x"]',
    result: null,
  });
  expect(contentOf('t', 'Edit', null)).toMatchObject({
    args: {},
    result: null,
  });
  expect(contentOf('t', 'Edit', 'x', { status: 'pending' })).toMatchObject({
    args: {},
    result: undefined,
  });
});

test('waits on the user for a question until it is answered', () => {
  expect(contentOf('t', 'Ask', {}, { question: QUESTION })).toMatchObject({
    interrupt: { type: 'human', payload: QUESTION },
    artifact: { question: QUESTION },
  });
  for (const question of [
    { ...QUESTION, answers: { question_0: 'red' } },
    { ...QUESTION, resolution: 'declined' as const },
  ]) {
    expect(contentOf('t', 'Ask', {}, { question })).not.toHaveProperty(
      'interrupt',
    );
  }
  expect(contentOf('t', 'Ask', {})).not.toHaveProperty('interrupt');
});

const NESTED_ASSISTANT = {
  createdAt: new Date(0),
  metadata: {
    unstable_state: null,
    unstable_annotations: [],
    unstable_data: [],
    steps: [],
    custom: {},
  },
};

test('nests the transcript of a subagent, keyed by its tool call path', () => {
  const inner = toolCall(
    'sub-2',
    'Agent',
    {},
    {
      status: 'in_progress',
      messages: [{ id: 'm0', role: 'assistant', parts: [ELICITATION] }],
    },
  );
  const messages = [
    {
      id: 'm0',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: 'go' }, inner],
    },
    {
      id: 'm1',
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text: 'ok' }, inner],
    },
  ];
  const running = contentOf(
    'sub-1',
    'Agent',
    {},
    { status: 'in_progress', messages },
  );
  expect(running).toMatchObject({
    messages: [
      {
        id: 'sub-1/m0',
        role: 'user',
        content: [{ type: 'text', text: 'go' }],
        attachments: [],
        createdAt: new Date(0),
        metadata: { custom: {} },
      },
      {
        ...NESTED_ASSISTANT,
        id: 'sub-1/m1',
        role: 'assistant',
        status: { type: 'running' },
        content: [
          { type: 'text', text: 'ok' },
          {
            toolCallId: 'sub-2',
            messages: [
              {
                ...NESTED_ASSISTANT,
                id: 'sub-1/m1/sub-2/m0',
                status: { type: 'running' },
                content: [{ type: 'data', name: 'elicitation' }],
              },
            ],
          },
        ],
      },
    ],
  });
  const done = contentOf(
    'sub-1',
    'Agent',
    {},
    {
      status: 'in_progress',
      messages: [messages[1], messages[0]],
    },
  );
  expect(done).toMatchObject({
    messages: [
      { status: { type: 'complete', reason: 'unknown' } },
      { role: 'user' },
    ],
  });
  const settled = contentOf('sub-1', 'Agent', {}, { messages: [messages[1]] });
  expect(settled).toMatchObject({
    messages: [{ status: { type: 'complete', reason: 'unknown' } }],
  });
});

test('shows the text and images of a user message', () => {
  const image = {
    type: 'image',
    image: 'data:image/png;base64,iVBOR',
  } as const;
  expect(
    threadMessageOf({
      id: 'm0',
      role: 'user',
      parts: [
        { type: 'text', text: 'hello' },
        image,
        toolCall('t', 'Read', {}),
      ],
    }),
  ).toEqual({
    id: 'm0',
    role: 'user',
    content: [{ type: 'text', text: 'hello' }, image],
    metadata: { custom: {} },
  });
});

test('marks spoken, steered and forwarded messages', () => {
  const from = { id: 'a2', name: 'helper' };
  expect(
    threadMessageOf({
      id: 'm1',
      role: 'assistant',
      parts: [],
      spoken: true,
      spokenUpTo: 0,
    }).metadata,
  ).toStrictEqual({ custom: { spokenUpTo: 0 } });
  expect(
    threadMessageOf({ id: 'm0', role: 'user', parts: [], from, steered: true })
      .metadata,
  ).toStrictEqual({ custom: { from, steered: true } });
  expect(
    threadMessageOf({ id: 'm1', role: 'assistant', parts: [], spoken: true })
      .metadata,
  ).toStrictEqual({ custom: {} });
  expect(isSpokenIn({ spokenUpTo: 0 })).toBe(true);
  expect(isSpokenIn({})).toBe(false);
});

test('reads the details choir attached to a tool call', () => {
  const none = { kind: 'other', status: 'completed', diffs: [], locations: [] };
  const details = { ...none, kind: 'edit', diffs: [DIFF] };
  expect(toolDetailsIn(details)).toBe(details);
  for (const artifact of [
    undefined,
    null,
    [],
    { diffs: [] },
    { locations: [] },
  ]) {
    expect(toolDetailsIn(artifact)).toEqual(none);
  }
});
