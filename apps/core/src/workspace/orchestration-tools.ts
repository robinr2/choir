import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  agentIdSchema,
  agentNameSchema,
  edgeSchema,
  splitKindSchema,
} from '../layout/layout.schemas.js';
import type { Workspace } from './workspace.port.js';

type Tool = (server: McpServer, workspace: Workspace, callerId: string) => void;

function reply(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

const splitPane: Tool = (server, workspace, callerId) => {
  server.registerTool(
    'split_pane',
    {
      description:
        "Split an agent's pane in half and start a new, empty agent in the new half: vertical puts it to the right, horizontal below. Splits your own pane unless agentId names another. Returns the new agent's ID and name.",
      inputSchema: z.object({
        direction: splitKindSchema,
        agentId: agentIdSchema.optional(),
        name: agentNameSchema.optional(),
      }),
    },
    async ({ direction, agentId, name }) =>
      reply(await workspace.split(agentId ?? callerId, direction, name)),
  );
};

const addPaneAtEdge: Tool = (server, workspace) => {
  server.registerTool(
    'add_pane_at_edge',
    {
      description:
        "Add a new column (left or right edge) or row (top or bottom edge) across the whole agent area, with a new, empty agent in it. Returns the new agent's ID and name.",
      inputSchema: z.object({
        edge: edgeSchema,
        name: agentNameSchema.optional(),
      }),
    },
    async ({ edge, name }) => reply(await workspace.addAtEdge(edge, name)),
  );
};

const sendMessage: Tool = (server, workspace, callerId) => {
  server.registerTool(
    'send_message',
    {
      description:
        "Send a text message to another agent. It shows in that agent's chat as a message from you and returns at once, without waiting for an answer. The agent answers, if it does, by sending you a message.",
      inputSchema: z.object({
        agentId: agentIdSchema,
        text: z.string().trim().min(1),
      }),
    },
    ({ agentId, text }) => {
      workspace.sendMessage(callerId, agentId, text);
      return reply({ sent: true });
    },
  );
};

const closeAgent: Tool = (server, workspace) => {
  server.registerTool(
    'close_agent',
    {
      description: "Close an agent's pane and end its session.",
      inputSchema: z.object({ agentId: agentIdSchema }),
    },
    async ({ agentId }) => {
      await workspace.close(agentId);
      return reply({ closed: true });
    },
  );
};

const listAgents: Tool = (server, workspace, callerId) => {
  server.registerTool(
    'list_agents',
    {
      description:
        'List every agent with its name, ID and whether it is working or idle, mark which one is you, and give the pane layout.',
      inputSchema: z.object({}),
    },
    async () => reply(await workspace.list(callerId)),
  );
};

const TOOLS = [splitPane, addPaneAtEdge, sendMessage, closeAgent, listAgents];

const INSTRUCTIONS =
  'The agents of this workspace are the panes the user sees, each running its own session. When the user asks for a new agent, start it in a new pane with split_pane or add_pane_at_edge, and reach it with send_message.';

export const CALLER_HEADER = 'x-choir-agent';

export function callerOf(request: Request | undefined): string {
  return request?.headers.get(CALLER_HEADER) ?? '';
}

function orchestrationServer(workspace: Workspace, callerId: string) {
  const server = new McpServer(
    { name: 'choir', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );
  for (const register of TOOLS) register(server, workspace, callerId);
  return server;
}

export function orchestrationHandler(workspace: Workspace) {
  return createMcpHandler(({ requestInfo }) =>
    orchestrationServer(workspace, callerOf(requestInfo)),
  );
}
