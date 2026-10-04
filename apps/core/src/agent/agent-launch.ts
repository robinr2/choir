import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChoirConfig } from '../choir/choir-config.js';
import type { AgentLaunch } from './agent-process.js';

const SETTING_SOURCES = ['project', 'local'];

export function claudeAgentPath(): string {
  const library = fileURLToPath(
    import.meta.resolve('@agentclientprotocol/claude-agent-acp'),
  );
  return path.join(path.dirname(library), 'index.js');
}

export function agentLaunch(
  config: ChoirConfig,
  {
    profile,
    cwd,
    conversationId,
  }: { profile: string; cwd: string; conversationId: string },
): AgentLaunch {
  return {
    command: config.agentCommand ?? [process.execPath, claudeAgentPath()],
    cwd,
    env: {
      CLAUDE_CODE_PLUGIN_DIRS: profile,
      CHOIR_CORE_URL: config.coreUrl,
      CHOIR_CONVERSATION_ID: conversationId,
      ...(config.claudeExecutable && {
        CLAUDE_CODE_EXECUTABLE: config.claudeExecutable,
      }),
    },
  };
}

export function sessionMeta(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    claudeCode: { options: { settingSources: SETTING_SOURCES } },
    ...extra,
  };
}
