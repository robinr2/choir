import { rm } from 'node:fs/promises';
import {
  Inject,
  Injectable,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import { agentLaunch, sessionMeta } from '../agent/agent-launch.js';
import { AgentSession } from '../agent/agent-session.js';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  judgeFolder,
  judgeProfileDir,
  judgeTranscripts,
} from '../choir/choir-config.js';
import { JudgeProfileService } from './judge-profile.service.js';

@Injectable()
export class ClaudeJudge implements BeforeApplicationShutdown {
  private readonly sessions = new Set<AgentSession>();

  constructor(
    @Inject(CHOIR_CONFIG) private readonly config: ChoirConfig,
    @Inject(JudgeProfileService)
    private readonly profile: Pick<JudgeProfileService, 'systemPrompt'>,
  ) {}

  async judge(notificationId: string): Promise<void> {
    const cwd = judgeFolder(this.config);
    const session = new AgentSession(
      agentLaunch(this.config, {
        profile: judgeProfileDir(this.config),
        cwd,
        conversationId: crypto.randomUUID(),
      }),
    );
    this.sessions.add(session);
    try {
      await this.decide(session, cwd, notificationId);
    } finally {
      this.sessions.delete(session);
      await session.close();
      await rm(judgeTranscripts(this.config), { recursive: true, force: true });
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    await Promise.all([...this.sessions].map((session) => session.close()));
  }

  private async decide(
    session: AgentSession,
    cwd: string,
    notificationId: string,
  ): Promise<void> {
    const append = await this.profile.systemPrompt();
    await session.start({
      cwd,
      mcpServers: [],
      _meta: sessionMeta({ systemPrompt: { append } }),
    });
    const turn = session.startTurn(`Judge the notification ${notificationId}.`);
    const result = await turn.result;
    if (result?.stopReason !== 'end_turn') {
      throw new Error(`The judge ended: ${JSON.stringify(result)}`);
    }
  }
}
