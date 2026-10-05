import type { Interaction } from '../agent/interactions.js';
import { withInteraction, withSettlement } from './interaction-parts.js';
import { toolCallPart } from './tool-call-part.js';
import type { TranscriptMessage, TranscriptPart } from './transcript.js';

const ROOT = 'root';

const OPTIONS = [
  { optionId: 'yes', name: 'Yes', kind: 'allow_once' },
  { optionId: 'always', name: 'Always', kind: 'allow_always' },
  { optionId: 'no', name: 'No', kind: 'reject_once' },
  { optionId: 'never', name: 'Never', kind: 'reject_always' },
] as const;

const APPROVAL_OPTIONS = [
  { id: 'yes', kind: 'allow-once', label: 'Yes' },
  { id: 'always', kind: 'allow-always', label: 'Always' },
  { id: 'no', kind: 'reject-once', label: 'No' },
  { id: 'never', kind: 'reject-always', label: 'Never' },
];

function permission(
  id: string,
  sessionId: string,
  title?: string,
): Interaction {
  return {
    id,
    kind: 'permission',
    request: {
      sessionId,
      toolCall: { toolCallId: 't1', title, rawInput: { command: 'ls' } },
      options: [...OPTIONS],
    },
  };
}

function elicitation(id: string, request: object): Interaction {
  return {
    id,
    kind: 'elicitation',
    request: { sessionId: ROOT, mode: 'form', message: 'Pick', ...request },
  };
}

const QUESTION = {
  toolCallId: 't1',
  requestedSchema: {
    type: 'object',
    properties: {
      question_0: {
        type: 'string',
        title: 'Size',
        oneOf: [{ const: 's', title: 'S' }],
      },
    },
  },
};

const RUNNING: TranscriptMessage[] = [
  { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'Go' }] },
  {
    id: 'm1',
    role: 'assistant',
    parts: [{ ...toolCallPart('t1', 1), toolName: 'Bash' }],
  },
];

function nestedParts(messages: TranscriptMessage[]): TranscriptPart[] {
  return messages
    .flatMap(({ parts }) => parts)
    .flatMap((part) => (part.type === 'tool-call' ? (part.messages ?? []) : []))
    .flatMap(({ parts }) => parts);
}

function partOf(messages: TranscriptMessage[]) {
  return messages.at(-1)?.parts.at(-1);
}

it('asks for an approval on the tool call it is about', () => {
  const asked = withInteraction(RUNNING, ROOT, permission('i1', ROOT, 'ls'), 5);
  expect(partOf(asked)).toEqual({
    ...toolCallPart('t1', 1),
    toolName: 'ls',
    args: { command: 'ls' },
    approval: { id: 'i1', prompt: 'ls', options: APPROVAL_OPTIONS },
  });
  const untitled = withInteraction(RUNNING, ROOT, permission('i1', ROOT), 5);
  expect(partOf(untitled)).toMatchObject({ toolName: 'Bash' });
  expect(partOf(untitled)).toHaveProperty('approval', {
    id: 'i1',
    options: APPROVAL_OPTIONS,
  });
});

it('shows the tool call of an approval it has not seen yet', () => {
  const asked = withInteraction([], ROOT, permission('i1', ROOT, 'ls'), 5);
  expect(asked).toEqual([
    {
      id: 'm0',
      role: 'assistant',
      parts: [
        {
          ...toolCallPart('t1', 5),
          toolName: 'ls',
          args: { command: 'ls' },
          approval: { id: 'i1', prompt: 'ls', options: APPROVAL_OPTIONS },
        },
      ],
    },
  ]);
});

it('settles an approval with the chosen option or as cancelled', () => {
  const asked = withInteraction(RUNNING, ROOT, permission('i1', ROOT, 'ls'), 5);
  const approval = (optionId: string) =>
    partOf(withSettlement(asked, 'i1', { optionId }));
  expect(approval('always')).toMatchObject({
    approval: { approved: true, optionId: 'always' },
  });
  expect(approval('no')).toMatchObject({
    approval: { approved: false, optionId: 'no' },
  });
  expect(approval('unknown')).toMatchObject({
    approval: { approved: false, optionId: 'unknown' },
  });
  expect(
    partOf(withSettlement(asked, 'i1', { action: 'cancel' })),
  ).toMatchObject({
    approval: { resolution: 'cancelled' },
  });
  expect(withSettlement(asked, 'other', { optionId: 'yes' })).toEqual(asked);
});

it('asks the questions of the agent on their tool call and keeps the answers', () => {
  const asked = withInteraction(RUNNING, ROOT, elicitation('q1', QUESTION), 5);
  expect(partOf(asked)).toMatchObject({
    toolName: 'Bash',
    question: { id: 'q1', questions: [{ id: 'question_0', header: 'Size' }] },
  });
  const content = {
    question_0: 's',
    question_0_custom: 'x',
    other: true,
    count: 2,
    many: ['a'],
  };
  expect(
    partOf(withSettlement(asked, 'q1', { action: 'accept', content })),
  ).toMatchObject({
    question: {
      answers: { question_0: 's', question_0_custom: 'x', many: ['a'] },
    },
  });
  expect(
    partOf(
      withSettlement(asked, 'q1', { action: 'accept', content: undefined }),
    ),
  ).toMatchObject({
    question: { answers: {} },
  });
  expect(
    partOf(withSettlement(asked, 'q1', { action: 'accept' })),
  ).toMatchObject({
    question: { answers: {} },
  });
  expect(partOf(withSettlement(asked, 'q1', { optionId: 'x' }))).toMatchObject({
    question: { answers: {} },
  });
  expect(
    partOf(withSettlement(asked, 'q1', { action: 'decline' })),
  ).toMatchObject({
    question: { resolution: 'declined' },
  });
  expect(
    partOf(withSettlement(asked, 'q1', { action: 'cancel' })),
  ).toMatchObject({
    question: { resolution: 'cancelled' },
  });
  const fresh = withInteraction([], ROOT, elicitation('q2', QUESTION), 7);
  expect(partOf(fresh)).toMatchObject({
    toolCallId: 't1',
    timing: { startedAt: 7 },
  });
});

it('shows forms of servers in the running reply and how the user answered', () => {
  const asked = withInteraction(RUNNING, ROOT, elicitation('e1', {}), 5);
  expect(partOf(asked)).toEqual({
    type: 'elicitation',
    id: 'e1',
    server: null,
    message: 'Pick',
    mode: 'form',
    fields: [],
    state: 'request',
  });
  const state = (answer: Parameters<typeof withSettlement>[2]) =>
    partOf(withSettlement(asked, 'e1', answer));
  expect(state({ action: 'accept' })).toMatchObject({ state: 'accepted' });
  expect(state({ action: 'decline' })).toMatchObject({ state: 'declined' });
  expect(state({ action: 'cancel' })).toMatchObject({ state: 'cancelled' });
  expect(state({ optionId: 'x' })).toMatchObject({ state: 'request' });
  expect(
    partOf(withSettlement(asked, 'other', { action: 'accept' })),
  ).toMatchObject({
    state: 'request',
  });
});

it('asks within the subagent the request comes from and settles there too', () => {
  const spawned: TranscriptMessage[] = [
    {
      id: 'm0',
      role: 'assistant',
      parts: [{ ...toolCallPart('child', 1), messages: [] }],
    },
  ];
  const asked = withInteraction(
    spawned,
    ROOT,
    permission('i1', 'child', 'ls'),
    5,
  );
  expect(nestedParts(asked)).toEqual([
    expect.objectContaining({
      approval: expect.objectContaining({ id: 'i1' }),
    }),
  ]);
  const settled = withSettlement(asked, 'i1', { optionId: 'yes' });
  expect(nestedParts(settled)[0]).toMatchObject({
    approval: { approved: true },
  });
});

it('asks in the root session for requests outside a session', () => {
  const scoped = withInteraction(
    [],
    ROOT,
    {
      id: 'e2',
      kind: 'elicitation',
      request: {
        requestId: 1,
        mode: 'url',
        url: 'https://x',
        elicitationId: 'x',
        message: 'Sign in',
      },
    },
    5,
  );
  expect(partOf(scoped)).toMatchObject({
    id: 'e2',
    mode: 'url',
    url: 'https://x',
  });
});
