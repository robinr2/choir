import { vi } from 'vitest';
import type { ConversationState } from '@/conversation/core-conversation';
import type { TranscriptMessage } from '@/conversation/transcript';
import type {
  Column,
  PaneView,
  StripLayout,
  WorkspaceView,
} from '@/workspace/core-workspace';
import { coreSends, fakeEventSources } from './fake-event-source';
import { agentsResponse, coreHasSessions } from './fake-agents';
import { coreHasInbox, inboxResponse } from './fake-inbox';

export const A = '0b6f2c9e-3f5d-4a8e-9c1b-2d7e6f5a4b3c';
export const B = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

export const CANVAS_URL = 'about:blank';

function respond(path: string, method?: string): Response | Promise<Response> {
  return (
    inboxResponse(path, method) ??
    agentsResponse(path, method) ??
    new Response(null, { status: 204 })
  );
}

export function fakeCore(): void {
  fakeEventSources();
  coreHasInbox({});
  coreHasSessions([]);
  vi.spyOn(window, 'fetch').mockImplementation(async (url, init) => {
    if (url === '/canvas') return Response.json({ url: CANVAS_URL });
    const path = url instanceof Request ? url.url : url.toString();
    return respond(path, init?.method);
  });
}

export function coreShowsWorkspace(view: Omit<WorkspaceView, 'loaded'>): void {
  coreSends('workspace', view);
}

export function said(
  id: string,
  role: TranscriptMessage['role'],
  text: string,
  marks: Partial<TranscriptMessage> = {},
): TranscriptMessage {
  return { id, role, parts: [{ type: 'text', text }], ...marks };
}

export function conversationState(
  change: Partial<ConversationState> = {},
): ConversationState {
  return {
    messages: [],
    session: null,
    status: { state: 'idle', since: 0 },
    queue: [],
    settings: null,
    usage: null,
    commands: [],
    plan: [],
    forks: [],
    ...change,
  };
}

export function coreShowsConversation(
  agentId: string,
  change: Partial<ConversationState> = {},
): void {
  coreSends('conversation', {
    id: agentId,
    state: conversationState(change),
  });
}

export function coreShowsChat(
  agentId: string,
  ...messages: TranscriptMessage[]
): void {
  coreShowsConversation(agentId, { messages });
}

type ToolCall = Extract<
  TranscriptMessage['parts'][number],
  { type: 'tool-call' }
>;

export function toolCall(
  toolCallId: string,
  toolName: string,
  args: unknown,
  change: Partial<ToolCall> = {},
): ToolCall {
  return {
    type: 'tool-call',
    toolCallId,
    toolName,
    kind: 'read',
    args,
    status: 'completed',
    diffs: [],
    locations: [],
    timing: { startedAt: 0 },
    ...change,
  };
}

export function column(
  id: string,
  paneIds: readonly string[],
  change: Partial<Column> = {},
): Column {
  return {
    id,
    width: 0.5,
    fullWidth: false,
    activeTile: 0,
    tiles: paneIds.map((paneId) => ({ paneId, height: { auto: 1 } })),
    ...change,
  };
}

export function strip(
  id: string,
  columns: readonly Column[],
  change: Partial<StripLayout> = {},
): StripLayout {
  return { id, columns, activeColumn: 0, restoresPrevious: false, ...change };
}

const LAST = strip('last', []);

export type CoreView = Omit<WorkspaceView, 'loaded'>;

export function viewOf(
  workspaces: readonly StripLayout[],
  panes: readonly PaneView[],
  change: Partial<CoreView> = {},
): CoreView {
  return {
    workspaces: [...workspaces, LAST],
    activeWorkspace: 0,
    panes,
    voiceAgentId: null,
    ...change,
  };
}

export function agent(id: string, name: string, working = false): PaneView {
  return { id, kind: 'agent', name, working };
}

export function twoAgents(voiceAgentId: string | null = null): CoreView {
  return viewOf(
    [strip('first', [column('left', [A]), column('right', [B])])],
    [agent(A, 'agent 1'), agent(B, 'agent 2', true)],
    { voiceAgentId },
  );
}
