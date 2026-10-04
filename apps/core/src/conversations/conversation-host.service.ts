import path from 'node:path';
import type { SessionUpdate } from '@agentclientprotocol/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { AgentCatalog } from '../agent/agent-catalog.js';
import { AgentService } from '../agent/agent.service.js';
import { CHOIR_CONFIG, type ChoirConfig } from '../choir/choir-config.js';
import { RateLimitsService } from '../rate-limits/rate-limits.service.js';
import type { TurnOutcome } from './conversations.port.js';
import type { TurnMark } from './transcript.js';
import { TurnMarks } from './turn-marks.js';
import { WorkingAgents } from './working-agents.js';

@Injectable()
export class ConversationHostService {
  private readonly logger = new Logger(ConversationHostService.name);
  private readonly working = new WorkingAgents();
  private readonly turnMarks: TurnMarks;

  constructor(
    @Inject(AgentService)
    private readonly agent: Pick<
      AgentService,
      'open' | 'close' | 'link' | 'catalog' | 'sessions' | 'fork'
    >,
    @Inject(CHOIR_CONFIG) config: ChoirConfig,
    @Inject(RateLimitsService)
    private readonly rateLimits: Pick<RateLimitsService, 'record'>,
  ) {
    this.turnMarks = new TurnMarks(path.join(config.dataDir, 'turn-marks'));
  }

  get workingChanges(): Observable<ReadonlySet<string>> {
    return this.working.changes;
  }

  open(id: string) {
    return this.agent.open(id);
  }

  close(session: { close(): Promise<void> }): Promise<void> {
    return this.agent.close(session);
  }

  async catalog(): Promise<AgentCatalog | null> {
    try {
      return await this.agent.catalog();
    } catch (error) {
      this.logger.error(`The agent catalog failed: ${String(error)}`);
      return null;
    }
  }

  link(id: string, sessionId: string, cwd: string): Promise<void> {
    return this.agent.link(id, sessionId, cwd);
  }

  sessions() {
    return this.agent.sessions();
  }

  fork(sessionId: string, cwd: string): Promise<string> {
    return this.agent.fork(sessionId, cwd);
  }

  loadMarks(id: string): Promise<Map<string, TurnMark>> {
    return this.turnMarks.load(id);
  }

  saveMarks(id: string, marks: ReadonlyMap<string, TurnMark>): Promise<void> {
    return this.turnMarks.save(id, marks);
  }

  usage(update: SessionUpdate): void {
    this.rateLimits.record(update);
  }

  ended(id: string, outcome: TurnOutcome): void {
    if ('summary' in outcome) {
      this.logger.log(`Conversation ${id} turn ${outcome.summary}`);
    } else {
      this.logger.error(
        `Conversation ${id} turn failed: ${String(outcome.error)}`,
      );
    }
  }

  follow(id: string, settled: Promise<void>): void {
    this.working.follow(id, settled);
  }

  forget(id: string): void {
    this.working.forget(id);
  }
}
