import { z } from 'zod';
import { paneIdSchema, agentNameSchema } from '../layout/layout.schemas.js';
import { reply, type Tool } from './tools.js';

const openAgent: Tool = (server, { workspace }) => {
  server.registerTool(
    'open_agent',
    {
      description:
        "Open a new, empty agent in a new pane, as its own column right after the focused column, and focus it. Returns the new agent's ID and name.",
      inputSchema: z.object({ name: agentNameSchema.optional() }),
    },
    async ({ name }) =>
      reply(await workspace.openPane({ kind: 'agent', name })),
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
        'List every agent with its name, ID and whether it is working or idle, mark which one is you, list the panes that hold no agent, such as the Excalidraw canvas, and give the pane layout: workspaces from top to bottom, each a strip of columns from left to right, each column a stack of panes from top to bottom.',
      inputSchema: z.object({}),
    },
    async () => reply(await workspace.list(callerId)),
  );
};

export const ORCHESTRATION_TOOLS = [
  openAgent,
  sendMessage,
  closeAgent,
  listAgents,
];
