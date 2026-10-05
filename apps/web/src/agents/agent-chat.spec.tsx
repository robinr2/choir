import { RTVIEvent } from '@pipecat-ai/client-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import {
  A,
  B,
  coreShowsChat,
  coreShowsConversation,
  fakeCore,
} from '@/test/fake-core';
import { CATALOG } from '@/test/fake-agents';
import { CoreConversation } from '@/conversation/core-conversation';
import { requests, streamOf } from '@/test/fake-event-source';
import { client } from '@/test/render-app';
import { chatOf } from '@/test/render-chat';

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('follows the agent it was last given', async () => {
  const screen = await render(chatOf(new CoreConversation(A)));
  await screen.rerender(chatOf(new CoreConversation(B)));
  await vi.waitFor(() =>
    expect(streamOf(`/conversations/${B}/events`)).toBeDefined(),
  );
  client.emit(RTVIEvent.UserTranscript, {
    text: 'hi',
    final: true,
    timestamp: '',
    user_id: '',
  });
  const composer = screen.getByRole('textbox');
  await expect.element(composer).toHaveValue('hi');
  coreShowsChat(B, {
    id: 'm0',
    role: 'user',
    parts: [{ type: 'text', text: 'hi' }],
  });
  await expect.element(composer).toHaveValue('');
  coreShowsChat(
    B,
    { id: 'm0', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'again' }] },
    {
      id: 'm2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hello.' }],
      spoken: true,
    },
  );
  await expect
    .element(screen.getByText('Hello.'))
    .toHaveClass('text-muted-foreground');
});

test('changes the settings of the conversation it was last given', async () => {
  const settings = {
    model: 'default',
    effort: 'high',
    mode: 'bypassPermissions',
    models: CATALOG.models,
    modes: CATALOG.modes,
  };
  const screen = await render(chatOf(new CoreConversation(A)));
  coreShowsConversation(A, { settings });
  await expect
    .element(screen.getByRole('combobox', { name: 'Mode', exact: true }))
    .toBeVisible();
  await screen.rerender(chatOf(new CoreConversation(B)));
  await vi.waitFor(() =>
    expect(streamOf(`/conversations/${B}/events`)).toBeDefined(),
  );
  coreShowsConversation(B, { settings });
  await screen.getByRole('combobox', { name: 'Mode', exact: true }).click();
  await page.getByRole('option', { name: 'Plan' }).click();
  await vi.waitFor(() =>
    expect(requests().filter(([url]) => url.endsWith('/settings'))).toEqual([
      [`/conversations/${B}/settings`, 'PUT', { mode: 'plan' }],
    ]),
  );
});
