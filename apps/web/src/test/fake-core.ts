import { vi } from 'vitest';
import type { TranscriptMessage } from '@/conversation/transcript';
import type { WorkspaceView } from '@/workspace/core-workspace';
import { fakeEventSources, streamOf } from './fake-event-source';
import { coreHasInbox, inboxResponse } from './fake-inbox';

export const A = '0b6f2c9e-3f5d-4a8e-9c1b-2d7e6f5a4b3c';
export const B = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

export const CANVAS_URL = 'about:blank';

export function fakeCore(): void {
  fakeEventSources();
  coreHasInbox({});
  vi.spyOn(window, 'fetch').mockImplementation(async (url, init) => {
    if (url === '/canvas') return Response.json({ url: CANVAS_URL });
    const path = url instanceof Request ? url.url : url.toString();
    return (
      inboxResponse(path, init?.method) ?? new Response(null, { status: 204 })
    );
  });
}

export function coreShowsWorkspace(view: Omit<WorkspaceView, 'loaded'>): void {
  streamOf('/workspace/events')?.receive(view);
}

export function said(
  id: string,
  role: TranscriptMessage['role'],
  text: string,
  marks: Partial<TranscriptMessage> = {},
): TranscriptMessage {
  return { id, role, parts: [{ type: 'text', text }], ...marks };
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
    panes: [
      { id: A, kind: 'agent', name: 'agent 1', working: false },
      { id: B, kind: 'agent', name: 'agent 2', working: true },
    ],
    voiceAgentId,
  };
}
