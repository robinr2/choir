import { RTVIEvent } from '@pipecat-ai/client-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { TranscriptMessage } from './conversation/transcript';
import {
  A,
  B,
  coreShowsChat,
  coreShowsWorkspace,
  fakeCore,
  twoAgents,
} from './test/fake-core';
import { requests } from './test/fake-event-source';
import {
  client,
  micOf,
  pane,
  renderApp,
  type Screen,
  stubVoice,
} from './test/render-app';

function said(
  id: string,
  role: TranscriptMessage['role'],
  text: string,
  marks: Partial<TranscriptMessage> = {},
): TranscriptMessage {
  return { id, role, parts: [{ type: 'text', text }], ...marks };
}

function muteButtonIn(screen: Screen, name: string) {
  return pane(screen, name).getByRole('button', { name: /mute microphone/i });
}

function voiceRequests() {
  return requests().filter(([url]) => url === '/workspace/voice');
}

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('turns voice on for one pane at a time over one connection', async () => {
  const { connect, disconnect } = stubVoice();
  const screen = await renderApp();
  await micOf(screen, 'agent 1').click();
  await expect
    .element(micOf(screen, 'agent 1'))
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .element(pane(screen, 'agent 1'))
    .toHaveAttribute('data-voice', 'true');
  await expect
    .element(
      pane(screen, 'agent 1').getByRole('status', { name: 'Voice is on' }),
    )
    .toBeVisible();
  await expect.element(pane(screen, 'agent 1')).toHaveClass('border-active/50');
  await expect.element(muteButtonIn(screen, 'agent 1')).toBeVisible();
  await expect.element(muteButtonIn(screen, 'agent 2')).not.toBeInTheDocument();
  await micOf(screen, 'agent 2').click();
  await expect
    .element(micOf(screen, 'agent 1'))
    .toHaveAttribute('aria-pressed', 'false');
  await expect.element(muteButtonIn(screen, 'agent 2')).toBeVisible();
  expect(connect).toHaveBeenCalledExactlyOnceWith({
    webrtcRequestParams: { endpoint: '/api/offer' },
  });
  await micOf(screen, 'agent 2').click();
  await expect
    .element(micOf(screen, 'agent 2'))
    .toHaveAttribute('aria-pressed', 'false');
  expect(disconnect).toHaveBeenCalledOnce();
  expect(voiceRequests()).toEqual([
    ['/workspace/voice', 'PUT', { agentId: A }],
    ['/workspace/voice', 'PUT', { agentId: B }],
    ['/workspace/voice', 'PUT', { agentId: null }],
  ]);
});

test('shows the voice bar only once the voice connection is ready', async () => {
  vi.spyOn(client, 'connect').mockReturnValue(new Promise(() => undefined));
  const screen = await renderApp();
  await micOf(screen, 'agent 1').click();
  await expect
    .element(micOf(screen, 'agent 1'))
    .toHaveAttribute('aria-pressed', 'true');
  await expect.element(muteButtonIn(screen, 'agent 1')).not.toBeInTheDocument();
});

test('turns voice off when core closes the voice agent', async () => {
  const { disconnect } = stubVoice();
  const screen = await renderApp();
  await micOf(screen, 'agent 1').click();
  coreShowsWorkspace({
    layout: B,
    panes: [{ id: B, kind: 'agent', name: 'agent 2', working: false }],
    voiceAgentId: null,
  });
  await vi.waitFor(() => expect(disconnect).toHaveBeenCalledOnce());
  await expect
    .element(micOf(screen, 'agent 2'))
    .toHaveAttribute('aria-pressed', 'false');
});

test('fills the voice pane composer with what the user says until the turn is sent', async () => {
  stubVoice();
  const screen = await renderApp(twoAgents(A));
  const composer = pane(screen, 'agent 1').getByRole('textbox');
  client.emit(RTVIEvent.UserTranscript, {
    text: 'hel',
    final: false,
    timestamp: '',
    user_id: '',
  });
  await expect.element(composer).toHaveValue('hel');
  await expect
    .element(pane(screen, 'agent 2').getByRole('textbox'))
    .toHaveValue('');
  coreShowsChat(A, said('m0', 'user', 'hello', { voice: true }));
  await expect.element(composer).toHaveValue('');
});

test('sends a typed message to the agent of its pane', async () => {
  const screen = await renderApp();
  await pane(screen, 'agent 2').getByRole('textbox').fill('hello choir');
  await pane(screen, 'agent 2')
    .getByRole('button', { name: 'Send message' })
    .click();
  await vi.waitFor(() =>
    expect(requests()).toContainEqual([
      `/conversations/${B}/user-turns`,
      'POST',
      { text: 'hello choir' },
    ]),
  );
});

test('shows the whole session of an agent with its tool calls', async () => {
  const screen = await renderApp();
  coreShowsChat(A, said('m0', 'user', 'read my notes'), {
    id: 'm1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-call',
        toolCallId: 'tool-1',
        toolName: 'Read',
        args: { filePath: 'notes.md' },
        result: { content: 'buy milk' },
        isError: false,
      },
      { type: 'text', text: 'You need milk.' },
    ],
  });
  const chat = pane(screen, 'agent 1');
  await expect.element(chat.getByText('read my notes')).toBeVisible();
  await chat.getByRole('button', { name: '1 tool call' }).click();
  await expect.element(chat.getByText('Used tool:')).toBeVisible();
  await expect.element(chat.getByText('You need milk.')).toBeVisible();
});

test('shows messages from agents with their name, and marks spoken replies', async () => {
  const screen = await renderApp();
  coreShowsChat(
    A,
    said('m0', 'user', 'say hello', { voice: true }),
    said('m1', 'assistant', 'Asking.', { voice: true }),
    said('m2', 'user', 'typed'),
    said('m3', 'assistant', 'Typed back.', { spoken: true }),
    said('m6', 'assistant', 'Written only.'),
    said('m4', 'user', 'Hello!', { from: { id: B, name: 'old name' } }),
    said('m5', 'user', 'Bye!', { from: { id: 'gone', name: 'closed agent' } }),
  );
  const chat = pane(screen, 'agent 1');
  await expect.element(chat.getByText('Voice conversation')).toBeVisible();
  await expect.element(chat.getByText('Hello!')).toBeVisible();
  await expect
    .element(chat.getByText('agent 2', { exact: true }))
    .toBeVisible();
  await expect.element(chat.getByText('closed agent')).toBeVisible();
  await expect.element(chat.getByText('Spoken aloud')).toBeInTheDocument();
  expect(chat.getByText('Spoken aloud').elements()).toHaveLength(1);
  const replies = [
    ...document.querySelectorAll('[data-slot="aui_assistant-message-root"]'),
  ];
  expect(
    replies.map((reply) => reply.textContent?.includes('Spoken aloud')),
  ).toEqual([true, false]);
  expect(
    document.querySelectorAll('[data-slot="agent-message-root"]'),
  ).toHaveLength(2);
});
