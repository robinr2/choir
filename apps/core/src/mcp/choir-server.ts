import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { CHOIR } from '../choir/choir-config.js';
import { NOTIFICATION_TOOLS } from './notification-tools.js';
import { ORCHESTRATION_TOOLS } from './orchestration-tools.js';
import { TODO_TOOLS } from './todo-tools.js';
import { CALLER_HEADER, type McpHandler } from './mcp.port.js';
import type { ChoirServices } from './tools.js';

const TOOLS = [...ORCHESTRATION_TOOLS, ...NOTIFICATION_TOOLS, ...TODO_TOOLS];

const INSTRUCTIONS =
  "The agents of this workspace are the panes the user sees, each running its own session. When the user asks for a new agent, start it in a new pane with split_pane or add_pane_at_edge, and reach other agents only with the send_message and list_agents tools of this server. The excalidraw tools draw on the one canvas all agents share, which the user sees in the Excalidraw pane; screenshots, image exports and Mermaid diagrams work only while that pane is open. The user's inbox holds notifications from outside services and the user's to-dos. When the user hands you a to-do by its ID, take it with grab_todo.";

export function callerOf(request: Request | undefined): string {
  return request?.headers.get(CALLER_HEADER) ?? '';
}

function choirServer(services: ChoirServices, callerId: string): McpServer {
  const server = new McpServer(CHOIR, { instructions: INSTRUCTIONS });
  for (const register of TOOLS) register(server, { ...services, callerId });
  return server;
}

export function choirHandler(services: ChoirServices): McpHandler {
  return toNodeHandler(
    createMcpHandler(({ requestInfo }) =>
      choirServer(services, callerOf(requestInfo)),
    ),
  );
}
