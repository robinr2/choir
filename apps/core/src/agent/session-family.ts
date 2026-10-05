import type { AgentUpdate } from './agent-updates.js';

export class SessionFamily {
  root = '';
  private readonly children = new Set<string>();

  admits({ sessionId, update }: AgentUpdate): boolean {
    if (sessionId !== this.root && !this.children.has(sessionId)) return false;
    if (update.sessionUpdate === 'subagent_spawned') {
      this.children.add(update.subagentSessionId);
    }
    return true;
  }
}
