import type { TranscriptMessage, TranscriptPart } from './transcript.js';
import {
  contentPart,
  upsertPart,
  withMessage,
  withPart,
  withReply,
  withUserContent,
} from './session-messages.js';

const TEXT = { type: 'text', text: 'Hi' } as const;

const IMAGE = { type: 'image', data: 'aGk=', mimeType: 'image/png' } as const;

function text(value: string): TranscriptPart {
  return { type: 'text', text: value };
}

function isCompaction(id: string) {
  return (
    part: TranscriptPart,
  ): part is Extract<TranscriptPart, { type: 'compaction' }> =>
    part.type === 'compaction' && part.id === id;
}

function compaction(id: string, summary = '') {
  return { type: 'compaction', id, status: 'in_progress', summary } as const;
}

it('turns text and images into parts and leaves other content out', () => {
  expect(contentPart(TEXT)).toEqual([text('Hi')]);
  expect(contentPart(IMAGE)).toEqual([
    { type: 'image', image: 'data:image/png;base64,aGk=' },
  ]);
  expect(
    contentPart({ type: 'audio', data: 'aGk=', mimeType: 'audio/wav' }),
  ).toEqual([]);
});

it('joins text and reasoning of the same kind that follow each other', () => {
  const reasoning = { type: 'reasoning', text: 'so' } as const;
  expect(withPart([], text('a'))).toEqual([text('a')]);
  expect(withPart([text('a')], text('b'))).toEqual([text('ab')]);
  expect(withPart([text('a')], reasoning)).toEqual([text('a'), reasoning]);
  expect(withPart([reasoning], { ...reasoning, text: 'on' })).toEqual([
    { type: 'reasoning', text: 'soon' },
  ]);
  const shown = compaction('c1');
  expect(withPart([shown], text('b'))).toEqual([shown, text('b')]);
  expect(withPart([text('a')], shown)).toEqual([text('a'), shown]);
});

it('numbers the messages it adds', () => {
  const one = withMessage([], { role: 'user', parts: [text('a')] });
  const two = withMessage(one, { role: 'assistant', parts: [], steered: true });
  expect(two).toEqual([
    { id: 'm0', role: 'user', parts: [text('a')] },
    { id: 'm1', role: 'assistant', parts: [], steered: true },
  ]);
});

it('adds to the running reply or starts one when there is something to add', () => {
  const asked: TranscriptMessage[] = [
    { id: 'm0', role: 'user', parts: [text('a')] },
  ];
  expect(withReply(asked, (parts) => parts)).toBe(asked);
  const replied = withReply(asked, (parts) => [...parts, text('b')]);
  expect(replied).toEqual([
    ...asked,
    { id: 'm1', role: 'assistant', parts: [text('b')] },
  ]);
  expect(withReply(replied, (parts) => [...parts, text('c')])).toEqual([
    ...asked,
    { id: 'm1', role: 'assistant', parts: [text('b'), text('c')] },
  ]);
  expect(withReply([], (parts) => [...parts, text('d')])).toEqual([
    { id: 'm0', role: 'assistant', parts: [text('d')] },
  ]);
});

it('collects the content of the user into one message until the agent answers', () => {
  const first = withUserContent([], TEXT);
  const second = withUserContent(first, IMAGE);
  const third = withUserContent(second, { ...TEXT, text: ' there' });
  expect(third).toEqual([
    {
      id: 'm0',
      role: 'user',
      parts: [
        text('Hi'),
        { type: 'image', image: 'data:image/png;base64,aGk=' },
        text(' there'),
      ],
    },
  ]);
  const answered = withReply(third, () => [text('Hello')]);
  expect(withUserContent(answered, TEXT).at(-1)).toEqual({
    id: 'm2',
    role: 'user',
    parts: [text('Hi')],
  });
});

it('changes the matching part wherever it is or adds a new one to the reply', () => {
  const messages: TranscriptMessage[] = [
    { id: 'm0', role: 'assistant', parts: [compaction('c1'), text('a')] },
    { id: 'm1', role: 'user', parts: [text('b')] },
  ];
  const changed = upsertPart(
    messages,
    isCompaction('c1'),
    (part) => ({ ...part, summary: 'done' }),
    () => compaction('never'),
  );
  expect(changed[0]?.parts).toEqual([compaction('c1', 'done'), text('a')]);
  expect(changed[1]).toEqual(messages[1]);
  const created = vi.fn<() => ReturnType<typeof compaction>>(() =>
    compaction('c2'),
  );
  const added = upsertPart(
    messages,
    isCompaction('c2'),
    (part) => ({ ...part, summary: 'new' }),
    created,
  );
  expect(added.at(-1)).toEqual({
    id: 'm2',
    role: 'assistant',
    parts: [compaction('c2', 'new')],
  });
  expect(
    upsertPart(
      messages,
      isCompaction('c3'),
      (part) => part,
      () => undefined,
    ),
  ).toBe(messages);
});
