import '@/index.css';
import { RTVIEvent } from '@pipecat-ai/client-js';
import { vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { CoreAgents } from '@/agents/core-agents';
import { CoreRateLimits } from '@/agents/core-rate-limits';
import App from '@/App';
import { CoreCanvas } from '@/canvas/core-canvas';
import { CoreInbox } from '@/inbox/core-inbox';
import { createPipecatClient } from '@/voice/create-pipecat-client';
import { CoreWorkspace } from '@/workspace/core-workspace';
import { coreShowsWorkspace, twoAgents } from './fake-core';

export type Screen = Awaited<ReturnType<typeof render>>;

export const client = createPipecatClient();

export async function renderApp(view = twoAgents()): Promise<Screen> {
  const screen = await render(
    <App
      client={client}
      workspace={new CoreWorkspace()}
      canvas={new CoreCanvas()}
      inbox={new CoreInbox()}
      agents={new CoreAgents()}
      rateLimits={new CoreRateLimits()}
    />,
  );
  coreShowsWorkspace(view);
  return screen;
}

export function botSaid(segment: number, spoken: string, rest: string): void {
  client.emit(RTVIEvent.BotOutput, {
    text: spoken + rest,
    aggregated_by: 'sentence',
    segment_id: segment,
    will_be_spoken: true,
    spoken_status: rest ? 'in-progress' : 'completed',
    spoken_progress: { accumulated_text: spoken, remaining_text: rest },
  });
}

export function pane(screen: Screen, name: string) {
  return screen.getByRole('region', { name });
}

export function micOf(screen: Screen, name: string) {
  return pane(screen, name).getByRole('button', { name: 'Voice' });
}

export function stubVoice() {
  return {
    connect: vi.spyOn(client, 'connect').mockImplementation(async () => {
      client.emit(RTVIEvent.TransportStateChanged, 'ready');
      return { version: '1.0.0' };
    }),
    disconnect: vi.spyOn(client, 'disconnect').mockImplementation(async () => {
      client.emit(RTVIEvent.TransportStateChanged, 'disconnected');
    }),
  };
}

export function dragEvent(type: string, dataTransfer: DataTransfer) {
  return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
}

function stopAtDocument(event: Event): void {
  event.stopPropagation();
}

export function dropOutsideAnyDrag(
  target: Element,
  dataTransfer: DataTransfer,
) {
  document.addEventListener('drop', stopAtDocument, { once: true });
  target.dispatchEvent(dragEvent('drop', dataTransfer));
}
