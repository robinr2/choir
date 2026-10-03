import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  type AcpRuntimeHandle,
  type AcpSessionRecord,
  type AcpxRuntime,
  createAcpRuntime,
  createAgentRegistry,
} from 'acpx/runtime';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  judgeFolder,
  judgeProfileDir,
  judgeTranscripts,
} from '../choir/choir-config.js';
import { JudgeProfileService } from './judge-profile.service.js';

const AGENT = 'claude';

@Injectable()
export class ClaudeJudge implements OnApplicationShutdown {
  private readonly records = new Map<string, AcpSessionRecord>();
  private readonly runtime: AcpxRuntime;

  constructor(
    @Inject(CHOIR_CONFIG) private readonly config: ChoirConfig,
    @Inject(JudgeProfileService)
    private readonly profile: Pick<JudgeProfileService, 'systemPrompt'>,
  ) {
    this.runtime = createAcpRuntime({
      cwd: judgeFolder(config),
      sessionStore: {
        load: async (id) => this.records.get(id),
        save: async (record) => {
          this.records.set(record.acpxRecordId, record);
        },
      },
      agentRegistry: createAgentRegistry({
        overrides: config.agentCommand && { [AGENT]: config.agentCommand },
      }),
      permissionMode: 'approve-all',
      agentProcessEnv: {
        CLAUDE_CODE_PLUGIN_DIRS: judgeProfileDir(config),
        CHOIR_CORE_URL: config.coreUrl,
        ...(config.claudeExecutable && {
          CLAUDE_CODE_EXECUTABLE: config.claudeExecutable,
        }),
      },
    });
  }

  async judge(notificationId: string): Promise<void> {
    const handle = await this.open();
    try {
      await this.runtime.setMode({ handle, mode: 'bypassPermissions' });
      await this.decide(handle, notificationId);
    } finally {
      await this.remove(handle);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.runtime.shutdown();
  }

  private async open(): Promise<AcpRuntimeHandle> {
    const sessionKey = randomUUID();
    return this.runtime.ensureSession({
      sessionKey,
      agent: AGENT,
      mode: 'oneshot',
      cwd: judgeFolder(this.config),
      sessionOptions: {
        systemPrompt: { append: await this.profile.systemPrompt() },
        env: { CHOIR_CONVERSATION_ID: sessionKey },
      },
    });
  }

  private async decide(
    handle: AcpRuntimeHandle,
    notificationId: string,
  ): Promise<void> {
    const turn = this.runtime.startTurn({
      handle,
      text: `Judge the notification ${notificationId}.`,
      mode: 'prompt',
      requestId: randomUUID(),
    });
    for await (const event of turn.events) void event;
    const result = await turn.result;
    if (result.status !== 'completed') {
      throw new Error(
        `The judge ended ${result.status}: ${JSON.stringify(result)}`,
      );
    }
  }

  private async remove(handle: AcpRuntimeHandle): Promise<void> {
    await this.runtime.close({ handle, reason: 'The judge has decided' });
    this.records.clear();
    await rm(judgeTranscripts(this.config), { recursive: true, force: true });
  }
}
