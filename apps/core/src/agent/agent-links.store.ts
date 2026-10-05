import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { AgentLink } from './agent-links.js';

@Injectable()
export class AgentLinksStore {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async find(conversationId: string): Promise<AgentLink | undefined> {
    const row = await this.database.orm.AgentLink.where({
      conversationId,
    }).first();
    return row ?? undefined;
  }

  async save(link: AgentLink): Promise<void> {
    const { sessionId, cwd, model, effort, mode } = link;
    await this.database.orm.AgentLink.upsert({
      create: link,
      update: { sessionId, cwd, model, effort, mode },
    });
  }
}
