import type {
  AnyMessage,
  SessionNotification,
  SessionUpdate,
} from '@agentclientprotocol/sdk';
import { z } from 'zod';

const CARRIER = 'choir/subagent';

const subagentUpdateSchema = z.union([
  z.looseObject({
    sessionUpdate: z.literal('subagent_spawned'),
    subagentSessionId: z.string(),
    name: z.string(),
    task: z.string(),
  }),
  z.looseObject({
    sessionUpdate: z.literal('subagent_state_update'),
    subagentSessionId: z.string(),
    state: z.string(),
  }),
]);

const subagentMessageSchema = z.looseObject({
  method: z.literal('session/update'),
  params: z.looseObject({ update: subagentUpdateSchema }),
});

const carrierSchema = z
  .object({ _meta: z.object({ [CARRIER]: subagentUpdateSchema }) })
  .transform(({ _meta: meta }) => meta[CARRIER]);

type SubagentUpdate = z.infer<typeof subagentUpdateSchema>;

export type AgentUpdate = {
  sessionId: string;
  update: SessionUpdate | SubagentUpdate;
};

export function carried(message: AnyMessage): AnyMessage {
  const subagent = subagentMessageSchema.safeParse(message);
  if (!subagent.success) return message;
  const { params } = subagent.data;
  const update = {
    sessionUpdate: 'session_info_update',
    _meta: { [CARRIER]: params.update },
  };
  return { ...message, params: { ...params, update } };
}

export function agentUpdate({
  sessionId,
  update,
}: SessionNotification): AgentUpdate {
  const subagent = carrierSchema.safeParse(update);
  if (!subagent.success) return { sessionId, update };
  return { sessionId, update: subagent.data };
}

export function isSessionUpdate(
  update: AgentUpdate['update'],
): update is SessionUpdate {
  return !subagentUpdateSchema.safeParse(update).success;
}

export function sessionUpdates(
  updates: readonly AgentUpdate[],
  sessionId: string,
): SessionUpdate[] {
  return updates.flatMap(({ sessionId: id, update }) =>
    id === sessionId && isSessionUpdate(update) ? [update] : [],
  );
}
