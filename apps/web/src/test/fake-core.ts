import { vi } from 'vitest';
import type { TranscriptMessage } from '@/conversation/transcript';
import type { WorkspaceView } from '@/workspace/core-workspace';
import { fakeEventSources, streamOf } from './fake-event-source';

export const A = '0b6f2c9e-3f5d-4a8e-9c1b-2d7e6f5a4b3c';
export const B = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

export function fakeCore(): void {
  fakeEventSources();
  vi.spyOn(window, 'fetch').mockImplementation(async () => {
    return new Response(null, { status: 204 });
  });
}

export function coreShowsWorkspace(view: Omit<WorkspaceView, 'loaded'>): void {
  streamOf('/workspace/events')?.receive(view);
}

export function coreShowsChat(
  agentId: string,
  ...messages: TranscriptMessage[]
): void {
  streamOf(`/conversations/${agentId}/events`)?.receive({ messages });
}

export function twoAgents(
  voiceAgentId: string | null = null,
): Omit<WorkspaceView, 'loaded'> {
  return {
    layout: {
      type: 'split',
      direction: 'row',
      children: [A, B],
      splitPercentages: [50, 50],
    },
    agents: [
      { id: A, name: 'agent 1', working: false },
      { id: B, name: 'agent 2', working: true },
    ],
    voiceAgentId,
  };
}
