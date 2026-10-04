import { agentLaunch, claudeAgentPath, sessionMeta } from './agent-launch.js';

const CONFIG = {
  dataDir: '/data',
  coreUrl: 'http://localhost:3100',
  canvasUrl: 'http://127.0.0.1:3100',
  canvasPublicUrl: 'http://127.0.0.1:3100',
  databaseUrl: 'postgresql://localhost/choir',
  claudeDir: '/claude',
};

const TARGET = { profile: '/profile', cwd: '/work', conversationId: 'c1' };

it('runs the Claude ACP adapter with the profile and the installed Claude Code', () => {
  expect(
    agentLaunch({ ...CONFIG, claudeExecutable: '/bin/claude' }, TARGET),
  ).toEqual({
    command: [process.execPath, claudeAgentPath()],
    cwd: '/work',
    env: {
      CLAUDE_CODE_PLUGIN_DIRS: '/profile',
      CHOIR_CORE_URL: 'http://localhost:3100',
      CHOIR_CONVERSATION_ID: 'c1',
      CLAUDE_CODE_FORK_SUBAGENT: '1',
      CLAUDE_CODE_EXECUTABLE: '/bin/claude',
    },
  });
  expect(claudeAgentPath()).toMatch(
    /@agentclientprotocol\/claude-agent-acp\/dist\/index\.js$/,
  );
});

it('runs another agent command when one is given', () => {
  expect(
    agentLaunch({ ...CONFIG, agentCommand: ['mock'] }, TARGET),
  ).toMatchObject({
    command: ['mock'],
    env: { CHOIR_CONVERSATION_ID: 'c1' },
  });
});

const THINKING = { type: 'adaptive', display: 'summarized' };

it('keeps the user settings of Claude Code out of every session and shows its thinking', () => {
  expect(sessionMeta()).toEqual({
    claudeCode: {
      options: { settingSources: ['project', 'local'], thinking: THINKING },
    },
  });
  expect(
    sessionMeta(
      { model: 'opus', effort: 'high' },
      { systemPrompt: { append: 'Judge.' } },
    ),
  ).toEqual({
    claudeCode: {
      options: {
        settingSources: ['project', 'local'],
        thinking: THINKING,
        model: 'opus',
        effort: 'high',
      },
    },
    systemPrompt: { append: 'Judge.' },
  });
});
