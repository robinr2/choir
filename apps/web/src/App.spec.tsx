import { RTVIEvent } from '@pipecat-ai/client-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';
import type { TranscriptMessage } from './conversation/transcript';
import { createPipecatClient } from './voice/create-pipecat-client';

type Screen = Awaited<ReturnType<typeof render>>;

const ID = '0b6f2c9e-3f5d-4a8e-9c1b-2d7e6f5a4b3c';
const client = createPipecatClient();
const pushers: ((messages: TranscriptMessage[]) => void)[] = [];
const followed: string[] = [];

function coreStreamsConversations(): void {
  vi.stubGlobal(
    'EventSource',
    class extends EventTarget {
      constructor(url: string) {
        super();
        followed.push(url);
        pushers.push((messages) => {
          const data = JSON.stringify({ messages });
          this.dispatchEvent(new MessageEvent('message', { data }));
        });
      }

      close(): void {}
    },
  );
}

function coreShows(...messages: TranscriptMessage[]): void {
  pushers.at(-1)?.(messages);
}

function userSaid(text: string): TranscriptMessage {
  return { id: 'm0', role: 'user', parts: [{ type: 'text', text }] };
}

function stubVoice() {
  return {
    connect: vi
      .spyOn(client, 'connect')
      .mockResolvedValue({ version: '1.0.0' }),
    disconnect: vi.spyOn(client, 'disconnect').mockResolvedValue(),
    sendText: vi.spyOn(client, 'sendText').mockResolvedValue(),
  };
}

function renderApp(pipecatClient = client): Promise<Screen> {
  return render(<App client={pipecatClient} conversationId={ID} />);
}

async function send(screen: Screen, text: string): Promise<void> {
  await screen.getByRole('textbox').fill(text);
  await screen.getByRole('button', { name: 'Send message' }).click();
}

function voiceToggle(screen: Screen) {
  return screen.getByRole('button', { name: 'Voice' });
}

async function turnVoiceOn(screen: Screen): Promise<void> {
  await voiceToggle(screen).click();
  await expect
    .element(screen.getByRole('button', { name: /mute microphone/i }))
    .toBeVisible();
}

function transcribe(text: string, final: boolean): void {
  client.emit(RTVIEvent.UserTranscript, {
    text,
    final,
    timestamp: '',
    user_id: '',
  });
}

beforeEach(() => {
  pushers.length = 0;
  followed.length = 0;
  coreStreamsConversations();
  vi.spyOn(window, 'fetch').mockResolvedValue(
    new Response('data: {"text":"Hi."}\n\n'),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('shows the whole session with its tool calls and their answer', async () => {
  const screen = await renderApp();
  coreShows(userSaid('read my notes'), {
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
  await expect.element(screen.getByText('read my notes')).toBeVisible();
  await screen.getByRole('button', { name: '1 tool call' }).click();
  await expect.element(screen.getByText('Used tool:')).toBeVisible();
  await expect.element(screen.getByText('Read', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('You need milk.')).toBeVisible();
});

test('sends a typed message to the conversation', async () => {
  const screen = await renderApp();
  await send(screen, 'hello choir');
  await vi.waitFor(() =>
    expect(window.fetch).toHaveBeenCalledWith(
      `/conversations/${ID}/user-turns`,
      expect.objectContaining({
        body: JSON.stringify({ text: 'hello choir' }),
      }),
    ),
  );
});

test('keeps voice off while a reply is being written', async () => {
  vi.spyOn(window, 'fetch').mockReturnValue(new Promise(() => undefined));
  const screen = await renderApp();
  await send(screen, 'hello choir');
  await expect.element(voiceToggle(screen)).toBeDisabled();
});

test('turns voice on and off for this conversation', async () => {
  const { connect, disconnect } = stubVoice();
  const screen = await renderApp();
  await expect
    .element(voiceToggle(screen))
    .toHaveAttribute('aria-pressed', 'false');
  await turnVoiceOn(screen);
  expect(connect).toHaveBeenCalledWith({
    webrtcRequestParams: { endpoint: `/api/offer?conversation_id=${ID}` },
  });
  await expect
    .element(voiceToggle(screen))
    .toHaveAttribute('aria-pressed', 'true');
  await voiceToggle(screen).click();
  expect(disconnect).toHaveBeenCalled();
  await expect
    .element(screen.getByRole('button', { name: /mute microphone/i }))
    .not.toBeInTheDocument();
});

test('shows voice as on while it connects', async () => {
  vi.spyOn(client, 'connect').mockReturnValue(new Promise(() => undefined));
  const screen = await renderApp();
  await voiceToggle(screen).click();
  await expect
    .element(voiceToggle(screen))
    .toHaveAttribute('aria-pressed', 'true');
  await voiceToggle(screen).click();
  await expect
    .element(voiceToggle(screen))
    .toHaveAttribute('aria-pressed', 'false');
});

test('connects voice through the client it was last given', async () => {
  const previous = createPipecatClient();
  const previousConnect = vi.spyOn(previous, 'connect');
  const { connect } = stubVoice();
  const screen = await renderApp(previous);
  await screen.rerender(<App client={client} conversationId={ID} />);
  await turnVoiceOn(screen);
  expect(connect).toHaveBeenCalled();
  expect(previousConnect).not.toHaveBeenCalled();
});

test('fills the composer with what the user says until the turn is sent', async () => {
  stubVoice();
  const screen = await renderApp();
  await turnVoiceOn(screen);
  transcribe('hel', false);
  await expect.element(screen.getByRole('textbox')).toHaveValue('hel');
  transcribe('hello choir', true);
  await expect.element(screen.getByRole('textbox')).toHaveValue('hello choir');
  coreShows(userSaid('hello choir'));
  await expect.element(screen.getByRole('textbox')).toHaveValue('');
  await expect.element(screen.getByText('hello choir')).toBeVisible();
});

test('hands typed text to the bot while voice is on', async () => {
  const { sendText } = stubVoice();
  const screen = await renderApp();
  await turnVoiceOn(screen);
  await send(screen, 'typed to the bot');
  await vi.waitFor(() =>
    expect(sendText).toHaveBeenCalledWith('typed to the bot'),
  );
  expect(window.fetch).not.toHaveBeenCalled();
});

test('follows the conversation it was last given', async () => {
  stubVoice();
  const other = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';
  const screen = await renderApp();
  await screen.rerender(<App client={client} conversationId={other} />);
  await vi.waitFor(() =>
    expect(followed).toContain(`/conversations/${other}/events`),
  );
  await turnVoiceOn(screen);
  transcribe('hi', true);
  await expect.element(screen.getByRole('textbox')).toHaveValue('hi');
  coreShows(userSaid('hi'));
  await expect.element(screen.getByRole('textbox')).toHaveValue('');
});
