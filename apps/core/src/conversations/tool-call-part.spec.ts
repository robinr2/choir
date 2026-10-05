import {
  isToolCall,
  toolCallPart,
  withToolCallUpdate,
} from './tool-call-part.js';

const STARTED = toolCallPart('t1', 100);

it('starts a pending tool call with what is known at first', () => {
  expect(STARTED).toEqual({
    type: 'tool-call',
    toolCallId: 't1',
    toolName: 'tool',
    kind: 'other',
    args: undefined,
    status: 'pending',
    diffs: [],
    locations: [],
    timing: { startedAt: 100 },
  });
  expect(isToolCall('t1')(STARTED)).toBe(true);
  expect(isToolCall('t2')(STARTED)).toBe(false);
  expect(isToolCall('t1')({ type: 'text', text: 't1' })).toBe(false);
});

it('takes the title, kind, input, diffs and locations of an update', () => {
  const updated = withToolCallUpdate(
    STARTED,
    {
      toolCallId: 't1',
      title: 'Edit notes.md',
      kind: 'edit',
      rawInput: { file_path: 'notes.md' },
      content: [
        { type: 'diff', path: 'notes.md', oldText: 'a', newText: 'b' },
        { type: 'diff', path: 'new.md', newText: 'c' },
      ],
      locations: [{ path: 'notes.md', line: 3 }, { path: 'new.md' }],
      status: 'in_progress',
    },
    150,
  );
  expect(updated).toEqual({
    ...STARTED,
    toolName: 'Edit notes.md',
    kind: 'edit',
    args: { file_path: 'notes.md' },
    diffs: [
      { path: 'notes.md', oldText: 'a', newText: 'b' },
      { path: 'new.md', oldText: null, newText: 'c' },
    ],
    locations: [{ path: 'notes.md', line: 3 }, { path: 'new.md' }],
    status: 'in_progress',
  });
});

it('keeps what an update leaves out', () => {
  const known = {
    ...STARTED,
    toolName: 'Read',
    kind: 'read',
    args: { path: 'a' },
    diffs: [{ path: 'a', oldText: null, newText: 'b' }],
    locations: [{ path: 'a' }],
  };
  expect(
    withToolCallUpdate(
      known,
      { toolCallId: 't1', title: '', kind: null, content: [], locations: null },
      200,
    ),
  ).toEqual(known);
  expect(
    withToolCallUpdate(known, { toolCallId: 't1', rawInput: null }, 200),
  ).toEqual({ ...known, args: null });
});

it('ends with the raw output or else the text of the result', () => {
  const ended = withToolCallUpdate(
    STARTED,
    {
      toolCallId: 't1',
      status: 'completed',
      content: [
        { type: 'content', content: { type: 'text', text: 'line 1' } },
        {
          type: 'content',
          content: { type: 'image', data: 'x', mimeType: 'image/png' },
        },
        { type: 'terminal', terminalId: 'term' },
        { type: 'content', content: { type: 'text', text: 'line 2' } },
      ],
    },
    300,
  );
  expect(ended).toMatchObject({
    status: 'completed',
    isError: false,
    result: 'line 1\nline 2',
    timing: { startedAt: 100, completedAt: 300 },
  });
  const raw = withToolCallUpdate(
    STARTED,
    {
      toolCallId: 't1',
      rawOutput: { ok: true },
      content: [{ type: 'content', content: { type: 'text', text: 'shown' } }],
    },
    300,
  );
  expect(raw.result).toEqual({ ok: true });
  expect(raw).not.toHaveProperty('isError');
});

it('marks a failed tool call and keeps the time it first ended', () => {
  const failed = withToolCallUpdate(
    STARTED,
    { toolCallId: 't1', status: 'failed' },
    400,
  );
  expect(failed).toMatchObject({
    status: 'failed',
    isError: true,
    timing: { startedAt: 100, completedAt: 400 },
  });
  expect(failed).not.toHaveProperty('result');
  const again = withToolCallUpdate(
    failed,
    { toolCallId: 't1', status: 'completed' },
    500,
  );
  expect(again).toMatchObject({
    status: 'completed',
    isError: false,
    timing: { completedAt: 400 },
  });
});
