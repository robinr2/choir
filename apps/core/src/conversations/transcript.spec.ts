import type { SessionUpdate } from '@agentclientprotocol/sdk';
import {
  answerText,
  type HistoryEntry,
  historyOf,
  liveMessages,
  type TranscriptPart,
  transcriptOf,
  withEvent,
} from './transcript.js';

type ToolCallUpdate = Extract<SessionUpdate, { sessionUpdate: 'tool_call' }>;

function toolCall(update: Partial<ToolCallUpdate>): SessionUpdate {
  return { sessionUpdate: 'tool_call', toolCallId: '', title: '', ...update };
}

function toolCallUpdate(
  update: Omit<
    Extract<SessionUpdate, { sessionUpdate: 'tool_call_update' }>,
    'sessionUpdate'
  >,
): SessionUpdate {
  return { sessionUpdate: 'tool_call_update', ...update };
}

function agentSays(text: string): SessionUpdate {
  return {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
  };
}

function thinks(text: string): SessionUpdate {
  return {
    sessionUpdate: 'agent_thought_chunk',
    content: { type: 'text', text },
  };
}

function userSays(text: string, messageId?: string): SessionUpdate {
  return {
    sessionUpdate: 'user_message_chunk',
    content: { type: 'text', text },
    messageId,
  };
}

function said(text: string): HistoryEntry {
  return { role: 'user', text };
}

function answered(text: string): HistoryEntry {
  return { role: 'assistant', parts: [{ type: 'text', text }] };
}

function applied(...updates: SessionUpdate[]): TranscriptPart[] {
  return updates.reduce<TranscriptPart[]>(withEvent, []);
}

describe('historyOf', () => {
  it('turns the replayed updates into user and agent messages', () => {
    expect(
      historyOf([
        userSays('read '),
        {
          sessionUpdate: 'user_message_chunk',
          content: { type: 'image', data: '', mimeType: 'image/png' },
        },
        userSays('my notes'),
        { sessionUpdate: 'available_commands_update', availableCommands: [] },
        thinks('hmm'),
        toolCall({
          toolCallId: 'tool-1',
          title: 'Read',
          rawInput: { filePath: 'notes.md' },
        }),
        toolCallUpdate({
          toolCallId: 'tool-1',
          status: 'completed',
          rawOutput: { content: 'hello' },
        }),
        agentSays('Done.'),
        userSays('thanks'),
        agentSays('You are '),
        agentSays('welcome.'),
      ]),
    ).toEqual([
      { role: 'user', text: 'read my notes' },
      {
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
      { role: 'user', text: 'thanks' },
      answered('You are welcome.'),
    ]);
  });

  it('separates user messages by their message ids', () => {
    expect(
      historyOf([
        userSays('first', 'u1'),
        userSays(' turn', 'u1'),
        userSays('second', 'u2'),
        userSays(' and more'),
      ]).map((entry) => entry.role === 'user' && entry.text),
    ).toEqual(['first turn', 'second and more']);
  });
});

describe('transcriptOf', () => {
  it('numbers the messages and keeps the parts of the answers', () => {
    expect(transcriptOf([said('hi'), answered('Hello.')], new Map())).toEqual([
      { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      {
        id: 'm1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello.' }],
      },
    ]);
  });

  it('marks the replies that were spoken and how much of them was heard', () => {
    const messages = transcriptOf(
      [
        answered('Welcome'),
        said('typed'),
        answered('A'),
        said('spoken'),
        answered('B'),
        said('typed again'),
        answered('D'),
        said('cut off'),
        answered('E'),
      ],
      new Map([
        ['spoken', { voice: true, aloud: true }],
        ['typed again', { aloud: true }],
        ['cut off', { voice: true, aloud: true, heard: '' }],
      ]),
    );
    expect(
      messages.map((message) => [
        message.spoken,
        message.heard,
        'heard' in message,
        'voice' in message,
      ]),
    ).toEqual([
      [undefined, undefined, false, false],
      [undefined, undefined, false, false],
      [undefined, undefined, false, false],
      [undefined, undefined, false, false],
      [true, undefined, false, false],
      [undefined, undefined, false, false],
      [true, undefined, false, false],
      [undefined, undefined, false, false],
      [true, '', true, false],
    ]);
  });

  it('shows a message from another agent as that agent wrote it', () => {
    const from = { id: 'a2', name: 'helper' };
    const messages = transcriptOf(
      [said('(framed) hi'), answered('Hello.')],
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

describe('liveMessages', () => {
  it('shows a running turn after the messages before it', () => {
    const from = { id: 'a2', name: 'helper' };
    expect(
      liveMessages(
        { prompt: '(framed) hi', mark: { from, text: 'hi', aloud: true } },
        [{ type: 'text', text: 'Hel' }],
        2,
      ),
    ).toEqual([
      { id: 'm2', role: 'user', parts: [{ type: 'text', text: 'hi' }], from },
      {
        id: 'm3',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hel' }],
        spoken: true,
      },
    ]);
  });
});

describe('answerText', () => {
  it('takes only the text the agent says', () => {
    expect(answerText(agentSays('Hi'))).toBe('Hi');
    expect(answerText(thinks('hmm'))).toBeUndefined();
    expect(answerText(userSays('Hi'))).toBeUndefined();
    expect(
      answerText({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'image', data: '', mimeType: 'image/png' },
      }),
    ).toBeUndefined();
    expect(answerText(toolCall({ title: 'Read' }))).toBeUndefined();
  });
});

describe('withEvent', () => {
  it('grows the answer text and starts new text after a tool call', () => {
    expect(
      applied(
        agentSays('Let me '),
        agentSays('look.'),
        thinks('hmm'),
        toolCall({ toolCallId: 'tool-1', title: 'Read' }),
        agentSays('Found it.'),
        { sessionUpdate: 'usage_update', used: 1, size: 2 },
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
          title: '',
          kind: 'read',
          status: 'pending',
          rawInput: { filePath: 'a' },
        }),
        toolCall({ toolCallId: 'tool-2', title: '' }),
        toolCallUpdate({
          toolCallId: 'tool-1',
          title: 'Read',
          status: 'failed',
          rawOutput: 'missing',
          rawInput: null,
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
        toolName: '',
        args: undefined,
      },
    ]);
  });

  it('names a tool call by its kind until it has a title', () => {
    expect(
      applied(
        toolCallUpdate({
          toolCallId: 'tool-1',
          kind: 'execute',
          status: 'completed',
        }),
        toolCallUpdate({ toolCallId: 'tool-2', title: null, kind: null }),
      ),
    ).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'execute',
        args: undefined,
        isError: false,
      },
      {
        type: 'tool-call',
        toolCallId: 'tool-2',
        toolName: 'tool_call',
        args: undefined,
      },
    ]);
  });
});
