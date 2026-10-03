import { z } from 'zod';
import {
  paneIdSchema,
  agentNameSchema,
  edgeSchema,
  splitKindSchema,
} from '../layout/layout.schemas.js';
import { reply, type Tool } from './tools.js';

const splitPane: Tool = (server, { workspace, callerId }) => {
  server.registerTool(
    'split_pane',
    {
      description:
        "Split an agent's pane in half and start a new, empty agent in the new half: vertical puts it to the right, horizontal below. Splits your own pane unless agentId names another. Returns the new agent's ID and name.",
      inputSchema: z.object({
        direction: splitKindSchema,
        agentId: paneIdSchema.optional(),
        name: agentNameSchema.optional(),
      }),
    },
    async ({ direction, agentId, name }) =>
      reply(
        await workspace.split(agentId ?? callerId, direction, {
          kind: 'agent',
          name,
        }),
      ),
  );
};

const addPaneAtEdge: Tool = (server, { workspace }) => {
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
    async ({ edge, name }) =>
      reply(await workspace.addAtEdge(edge, { kind: 'agent', name })),
  );
};

const sendMessage: Tool = (server, { workspace, callerId }) => {
  server.registerTool(
    'send_message',
    {
      description:
        "Send a text message to another agent. It shows in that agent's chat as a message from you and returns at once, without waiting for an answer. The agent answers, if it does, by sending you a message.",
      inputSchema: z.object({
        agentId: paneIdSchema,
        text: z.string().trim().min(1),
      }),
    },
    ({ agentId, text }) => {
      workspace.sendMessage(callerId, agentId, text);
      return reply({ sent: true });
    },
  );
};

const closeAgent: Tool = (server, { workspace }) => {
  server.registerTool(
    'close_agent',
    {
      description: "Close an agent's pane and end its session.",
      inputSchema: z.object({ agentId: paneIdSchema }),
    },
    async ({ agentId }) => {
      await workspace.close(agentId);
      return reply({ closed: true });
    },
  );
};

const listAgents: Tool = (server, { workspace, callerId }) => {
  server.registerTool(
    'list_agents',
    {
      description:
        'List every agent with its name, ID and whether it is working or idle, mark which one is you, list the panes that hold no agent, such as the Excalidraw canvas, and give the pane layout.',
      inputSchema: z.object({}),
    },
    async () => reply(await workspace.list(callerId)),
  );
};

export const ORCHESTRATION_TOOLS = [
  splitPane,
  addPaneAtEdge,
  sendMessage,
  closeAgent,
  listAgents,
];
