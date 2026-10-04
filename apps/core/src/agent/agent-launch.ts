import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChoirConfig } from '../choir/choir-config.js';
import type { ClaudeOptions } from './agent-links.js';
import type { AgentLaunch } from './agent-process.js';

const SETTING_SOURCES = ['project', 'local'];

const THINKING = { type: 'adaptive', display: 'summarized' };

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
      CLAUDE_CODE_FORK_SUBAGENT: '1',
      ...(config.claudeExecutable && {
        CLAUDE_CODE_EXECUTABLE: config.claudeExecutable,
      }),
    },
  };
}

export function sessionMeta(
  options: ClaudeOptions = {},
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    claudeCode: {
      options: {
        settingSources: SETTING_SOURCES,
        thinking: THINKING,
        ...options,
      },
    },
    ...extra,
  };
}
