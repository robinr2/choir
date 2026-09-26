import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  type AcpRuntimeHandle,
  type AcpRuntimeTurn,
  type AcpSessionRecord,
  type AcpSessionStore,
  type AcpxRuntime,
  createAcpRuntime,
  createAgentRegistry,
  createRuntimeStore,
} from 'acpx/runtime';
import {
  CHOIR_CONFIG,
  type ChoirConfig,
  profileDir,
  sessionFolder,
  sessionsDir,
} from '../choir/choir-config.js';

const AGENT = 'claude';
const BYPASS_PERMISSIONS = 'bypassPermissions';

@Injectable()
export class AgentService implements OnApplicationShutdown {
  private readonly store: AcpSessionStore;
  private readonly runtime: AcpxRuntime;

  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {
    this.store = createRuntimeStore({ stateDir: sessionsDir(config) });
    this.runtime = createAcpRuntime({
      cwd: sessionFolder(config),
      sessionStore: this.store,
      agentRegistry: createAgentRegistry({
        overrides: config.agentCommand && { [AGENT]: config.agentCommand },
      }),
      permissionMode: 'approve-all',
      agentProcessEnv: {
        CLAUDE_CODE_PLUGIN_DIRS: profileDir(config),
        CHOIR_CORE_URL: config.coreUrl,
        ...(config.claudeExecutable && {
          CLAUDE_CODE_EXECUTABLE: config.claudeExecutable,
        }),
      },
    });
  }

  async open(conversationId: string): Promise<AcpRuntimeHandle> {
    const handle = await this.runtime.ensureSession({
      sessionKey: conversationId,
      agent: AGENT,
      mode: 'persistent',
      cwd: sessionFolder(this.config),
      sessionOptions: { env: { CHOIR_CONVERSATION_ID: conversationId } },
    });
    const record = await this.record(handle);
    if (record.acpx?.desired_mode_id !== BYPASS_PERMISSIONS) {
      await this.runtime.setMode({ handle, mode: BYPASS_PERMISSIONS });
    }
    return handle;
  }

  async record(handle: AcpRuntimeHandle): Promise<AcpSessionRecord> {
    const id = handle.acpxRecordId;
    const record = id && (await this.store.load(id));
    if (!record) throw new Error(`No saved session for ${handle.sessionKey}`);
    return record;
  }

  startTurn(handle: AcpRuntimeHandle, text: string): AcpRuntimeTurn {
    return this.runtime.startTurn({
      handle,
      text,
      mode: 'prompt',
      requestId: randomUUID(),
    });
  }

  async close(handle: AcpRuntimeHandle): Promise<void> {
    await this.runtime.close({ handle, reason: 'The agent was closed' });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.runtime.shutdown();
  }
}
