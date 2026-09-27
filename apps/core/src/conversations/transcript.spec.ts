import type { AcpRuntimeEvent } from 'acpx/runtime';
import {
  answerText,
  type TranscriptPart,
  transcriptOf,
  withEvent,
} from './transcript.js';

const toolUse = {
  id: 'tool-1',
  name: 'Read',
  raw_input: '{"filePath":"notes.md"}',
  input: { filePath: 'notes.md' },
  is_input_complete: true,
};

function toolCall(
  event: Partial<Extract<AcpRuntimeEvent, { type: 'tool_call' }>>,
) {
  return { type: 'tool_call' as const, text: '', ...event };
}

function said(text: string) {
  return { User: { id: text, content: [{ Text: text }] } };
}

function answered(text: string) {
  return { Agent: { content: [{ Text: text }], tool_results: {} } };
}

function applied(...events: AcpRuntimeEvent[]): TranscriptPart[] {
  return events.reduce<TranscriptPart[]>(withEvent, []);
}

describe('transcriptOf', () => {
  it('turns user and agent messages into chat messages', () => {
    const messages = transcriptOf(
      {
        messages: [
          {
            User: {
              id: 'u1',
              content: [
                { Text: 'read ' },
                { Mention: { uri: 'file:///notes.md', content: '' } },
                { Text: 'my notes' },
              ],
            },
          },
          'Resume',
          {
            Agent: {
              content: [
                { Thinking: { text: 'hmm' } },
                { ToolUse: toolUse },
                { Text: 'Done.' },
              ],
              tool_results: {
                'tool-1': {
                  tool_use_id: 'tool-1',
                  tool_name: 'Read',
                  is_error: false,
                  content: { Text: 'hello' },
                  output: { content: 'hello' },
                },
              },
            },
          },
        ],
      },
      new Map(),
    );
    expect(messages).toEqual([
      {
        id: 'm0',
        role: 'user',
        parts: [{ type: 'text', text: 'read my notes' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-call',
            toolCallId: 'tool-1',
            toolName: 'Read',
            args: { filePath: 'notes.md' },
            result: { content: 'hello' },
            isError: false,
          },
          { type: 'text', text: 'Done.' },
        ],
      },
    ]);
  });

  it('keeps a tool call that has no result yet', () => {
    const [message] = transcriptOf(
      {
        messages: [
          { Agent: { content: [{ ToolUse: toolUse }], tool_results: {} } },
        ],
      },
      new Map(),
    );
    expect(message?.parts).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'Read',
        args: { filePath: 'notes.md' },
        result: undefined,
        isError: undefined,
      },
    ]);
  });

  it('marks the exchanges that were spoken', () => {
    const messages = transcriptOf(
      {
        messages: [
          answered('Welcome'),
          said('typed'),
          answered('A'),
          said('spoken'),
          answered('B'),
          answered('C'),
          said('typed again'),
          answered('D'),
        ],
      },
      new Map([
        ['spoken', { voice: true, aloud: true }],
        ['typed again', { aloud: true }],
      ]),
    );
    expect(messages.map(({ voice, spoken }) => [voice, spoken])).toEqual([
      [undefined, undefined],
      [undefined, undefined],
      [undefined, undefined],
      [true, undefined],
      [true, undefined],
      [true, undefined],
      [undefined, undefined],
      [undefined, true],
    ]);
  });

  it('shows a message from another agent as that agent wrote it', () => {
    const from = { id: 'a2', name: 'helper' };
    const messages = transcriptOf(
      { messages: [said('(framed) hi'), answered('Hello.')] },
      new Map([['(framed) hi', { from, text: 'hi' }]]),
    );
    expect(messages).toEqual([
      { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'hi' }], from },
      {
        id: 'm1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello.' }],
      },
    ]);
  });
});

describe('answerText', () => {
  it('takes only the text the agent says', () => {
    expect(answerText({ type: 'text_delta', text: 'Hi' })).toBe('Hi');
    expect(
      answerText({ type: 'text_delta', text: 'Hi', stream: 'output' }),
    ).toBe('Hi');
    expect(
      answerText({ type: 'text_delta', text: 'hmm', stream: 'thought' }),
    ).toBeUndefined();
    expect(answerText(toolCall({ text: 'Read' }))).toBeUndefined();
  });
});

describe('withEvent', () => {
  it('grows the answer text and starts new text after a tool call', () => {
    expect(
      applied(
        { type: 'text_delta', text: 'Let me ' },
        { type: 'text_delta', text: 'look.' },
        { type: 'text_delta', text: 'hmm', stream: 'thought' },
        toolCall({ toolCallId: 'tool-1', title: 'Read' }),
        { type: 'text_delta', text: 'Found it.' },
        { type: 'status', text: 'usage' },
      ),
    ).toEqual([
      { type: 'text', text: 'Let me look.' },
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'Read',
        args: undefined,
      },
      { type: 'text', text: 'Found it.' },
    ]);
  });

  it('updates a tool call as its updates arrive', () => {
    expect(
      applied(
        toolCall({
          toolCallId: 'tool-1',
          kind: 'read',
          status: 'pending',
          rawInput: { filePath: 'a' },
        }),
        toolCall({ toolCallId: 'tool-2' }),
        toolCall({
          toolCallId: 'tool-1',
          title: 'Read',
          status: 'failed',
          rawOutput: 'missing',
        }),
      ),
    ).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'Read',
        args: { filePath: 'a' },
        result: 'missing',
        isError: true,
      },
      {
        type: 'tool-call',
        toolCallId: 'tool-2',
        toolName: 'tool_call',
        args: undefined,
      },
    ]);
  });

  it('marks a completed tool call as no error, and names it by its kind', () => {
    expect(
      applied(
        toolCall({
          toolCallId: 'tool-1',
          kind: 'execute',
          status: 'completed',
        }),
      ),
    ).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'execute',
        args: undefined,
        isError: false,
      },
    ]);
  });

  it('keeps a tool call without an id under an empty id', () => {
    expect(applied(toolCall({ title: 'Read' }))).toEqual([
      { type: 'tool-call', toolCallId: '', toolName: 'Read', args: undefined },
    ]);
  });
});
