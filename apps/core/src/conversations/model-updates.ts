import type { SessionUpdate } from '@agentclientprotocol/sdk';
import { type AgentUpdate, isSessionUpdate } from '../agent/agent-updates.js';
import type { ConversationModel } from './conversation-state.js';
import { withDetails } from './session-details.js';
import { subagentsRunning } from './subagent-parts.js';
import { withAgentUpdate } from './transcript-updates.js';

export function sessionUpdateOf({
  update,
}: AgentUpdate): SessionUpdate | undefined {
  return isSessionUpdate(update) ? update : undefined;
}

export function withReceived(
  model: ConversationModel,
  root: string,
  received: AgentUpdate,
  at: number,
): ConversationModel {
  const update = received.sessionId === root && sessionUpdateOf(received);
  return {
    ...model,
    messages: withAgentUpdate(model.messages, root, received, at),
    details: update ? withDetails(model.details, update) : model.details,
  };
}

export function holds(
  { messages }: ConversationModel,
  root: string,
  { sessionId, update }: AgentUpdate,
): boolean {
  if (sessionId !== root || update.sessionUpdate !== 'usage_update') {
    return false;
  }
  return Boolean(update.cost) && subagentsRunning(messages);
}
