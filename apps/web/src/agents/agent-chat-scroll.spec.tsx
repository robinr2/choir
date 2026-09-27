import { RTVIEvent } from '@pipecat-ai/client-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { TranscriptMessage } from '@/conversation/transcript';
import {
  A,
  B,
  coreShowsChat,
  fakeCore,
  said,
  twoAgents,
} from '@/test/fake-core';
import {
  botSaid,
  client,
  pane,
  renderApp,
  type Screen,
  stubVoice,
} from '@/test/render-app';

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function chatOf(count: number): TranscriptMessage[] {
  return Array.from({ length: count }, (_, index) =>
    said(`m${index}`, index % 2 ? 'assistant' : 'user', `line ${index}`),
  );
}

function viewportOf(screen: Screen, name: string): HTMLElement {
  const viewport = pane(screen, name)
    .element()
    .querySelector<HTMLElement>('[data-slot="aui_thread-viewport"]');
  if (!viewport) throw new Error(`${name} shows no chat`);
  return viewport;
}

function distanceToBottom(viewport: HTMLElement): number {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

function isAtBottom(screen: Screen) {
  return (name: string) =>
    expect(distanceToBottom(viewportOf(screen, name))).toBeLessThanOrEqual(1);
}

async function shows(
  screen: Screen,
  name: string,
  text: string,
  scrolled: (name: string) => void,
) {
  await expect.element(pane(screen, name).getByText(text)).toBeInTheDocument();
  await vi.waitFor(() => scrolled(name));
}

function chatIn(agentId: string, history: TranscriptMessage[]) {
  const messages = [...history];
  return (...added: TranscriptMessage[]) => {
    messages.push(...added);
    coreShowsChat(agentId, ...messages);
  };
}

async function sendTyped(screen: Screen, name: string, text: string) {
  await pane(screen, name).getByRole('textbox').fill(text);
  await pane(screen, name)
    .getByRole('button', { name: 'Send message' })
    .click();
}

function userSays(text: string): void {
  client.emit(RTVIEvent.UserTranscript, {
    text,
    final: true,
    timestamp: '',
    user_id: '',
  });
}

async function voiceAndTypedPanes() {
  stubVoice();
  const screen = await renderApp(twoAgents(A));
  const history = chatOf(40);
  const voiced = chatIn(A, history);
  const typed = chatIn(B, history);
  voiced();
  typed();
  await shows(screen, 'agent 1', 'line 39', isAtBottom(screen));
  await shows(screen, 'agent 2', 'line 39', isAtBottom(screen));
  return { screen, voiced, typed };
}

async function everyKindOfMessageArrives(
  screen: Screen,
  voiced: ReturnType<typeof chatIn>,
  typed: ReturnType<typeof chatIn>,
  scrolled: (name: string) => void,
) {
  const shown = (name: string, text: string) =>
    shows(screen, name, text, scrolled);
  voiced(
    said('m40', 'user', 'Hello from 2!', { from: { id: B, name: 'agent 2' } }),
  );
  await shown('agent 1', 'Hello from 2!');
  userSays('spoken question');
  voiced(said('m41', 'user', 'spoken question'));
  await shown('agent 1', 'spoken question');
  voiced(said('m42', 'assistant', 'Spoken answer.', { spoken: true }));
  await shown('agent 1', 'Spoken answer.');
  botSaid(1, 'Spoken', ' answer.');
  await sendTyped(screen, 'agent 2', 'typed question');
  typed(said('m40', 'user', 'typed question'));
  await shown('agent 2', 'typed question');
  typed(said('m41', 'assistant', 'Typed answer.'));
  await shown('agent 2', 'Typed answer.');
}

test('keeps every pane at the bottom whatever kind of message arrives in it', async () => {
  const { screen, voiced, typed } = await voiceAndTypedPanes();
  await pane(screen, 'agent 2').getByRole('textbox').click();
  await everyKindOfMessageArrives(screen, voiced, typed, isAtBottom(screen));
  const distances = ['agent 1', 'agent 2'].map((name) =>
    distanceToBottom(viewportOf(screen, name)),
  );
  expect(Math.max(...distances)).toBeLessThanOrEqual(1);
});

test('leaves every pane where the user scrolled up to when messages arrive', async () => {
  const { screen, voiced, typed } = await voiceAndTypedPanes();
  const viewports = [
    viewportOf(screen, 'agent 1'),
    viewportOf(screen, 'agent 2'),
  ];
  for (const viewport of viewports)
    viewport.scrollTo({ top: viewport.scrollTop - 50, behavior: 'instant' });
  await vi.waitFor(() =>
    expect(viewports.map(distanceToBottom)).toEqual([50, 50]),
  );
  const scrolledTo = viewports.map((viewport) => viewport.scrollTop);
  const stays = (name: string) =>
    expect(viewportOf(screen, name).scrollTop).toBe(
      scrolledTo[name === 'agent 1' ? 0 : 1],
    );
  await everyKindOfMessageArrives(screen, voiced, typed, stays);
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(viewports.map((viewport) => viewport.scrollTop)).toEqual(scrolledTo);
});
