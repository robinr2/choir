import { RTVIEvent } from '@pipecat-ai/client-js';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import App from './App';
import { createPipecatClient } from './voice/create-pipecat-client';

type Screen = Awaited<ReturnType<typeof render>>;

const client = createPipecatClient();

function coreEchoes(): void {
  vi.spyOn(window, 'fetch').mockImplementation(async (_input, init) => {
    const body = init?.body;
    if (typeof body !== 'string') throw new Error('Expected a JSON body');
    return new Response(`data: ${body}\n\n`);
  });
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

function spokenMessage(screen: Screen, role: 'user' | 'assistant') {
  return screen
    .getByText(role === 'user' ? 'You said' : 'Assistant said')
    .element()
    .closest('[data-slot="aui_spoken-message-root"]');
}

beforeEach(() => {
  coreEchoes();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('echoes a sent message back as the reply', async () => {
  const screen = await render(<App client={client} />);
  await send(screen, 'hello choir');
  await expect.element(screen.getByText('hello choir').nth(1)).toBeVisible();
});

test('echoes only the latest message', async () => {
  const screen = await render(<App client={client} />);
  await send(screen, 'first');
  await expect.element(screen.getByText('first').nth(1)).toBeVisible();
  await send(screen, 'second');
  await expect.element(screen.getByText('second').nth(1)).toBeVisible();
  await expect
    .element(screen.getByText('first').nth(2))
    .not.toBeInTheDocument();
});

test('turns voice on and off with the mic toggle', async () => {
  const { connect, disconnect } = stubVoice();
  const screen = await render(<App client={client} />);
  await expect
    .element(voiceToggle(screen))
    .toHaveAttribute('aria-pressed', 'false');
  await turnVoiceOn(screen);
  expect(connect).toHaveBeenCalled();
  await expect
    .element(voiceToggle(screen))
    .toHaveAttribute('aria-pressed', 'true');
  await voiceToggle(screen).click();
  expect(disconnect).toHaveBeenCalled();
  await expect
    .element(voiceToggle(screen))
    .toHaveAttribute('aria-pressed', 'false');
  await expect
    .element(screen.getByRole('button', { name: /mute microphone/i }))
    .not.toBeInTheDocument();
});

test('shows voice as on while it connects', async () => {
  vi.spyOn(client, 'connect').mockReturnValue(new Promise(() => undefined));
  const screen = await render(<App client={client} />);
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
  const screen = await render(<App client={previous} />);
  await screen.rerender(<App client={client} />);
  await turnVoiceOn(screen);
  expect(connect).toHaveBeenCalled();
  expect(previousConnect).not.toHaveBeenCalled();
});

test('shows the spoken turn and its echo in the chat', async () => {
  stubVoice();
  const screen = await render(<App client={client} />);
  await turnVoiceOn(screen);
  client.emit(RTVIEvent.UserTranscript, {
    text: 'hello choir',
    final: true,
    timestamp: '',
    user_id: '',
  });
  client.emit(RTVIEvent.BotStartedSpeaking);
  client.emit(RTVIEvent.BotOutput, { text: 'hello choir', segment_id: 1 });
  client.emit(RTVIEvent.BotStoppedSpeaking);
  await expect
    .poll(() => spokenMessage(screen, 'user')?.textContent)
    .toContain('hello choir');
  await expect
    .poll(() => spokenMessage(screen, 'assistant')?.textContent)
    .toContain('hello choir');
});

test('hands typed text to the bot while voice is on', async () => {
  const { sendText } = stubVoice();
  const screen = await render(<App client={client} />);
  await turnVoiceOn(screen);
  await send(screen, 'typed to the bot');
  await expect.element(screen.getByText('typed to the bot')).toBeVisible();
  expect(sendText).toHaveBeenCalledWith('typed to the bot');
  expect(window.fetch).not.toHaveBeenCalled();
});

test('keeps voice off while a reply is being written', async () => {
  vi.spyOn(window, 'fetch').mockReturnValue(new Promise(() => undefined));
  const screen = await render(<App client={client} />);
  await send(screen, 'hello choir');
  await expect.element(voiceToggle(screen)).toBeDisabled();
});
