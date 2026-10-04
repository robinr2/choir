import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class AgentSessionsStore {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async find(conversationId: string): Promise<string | undefined> {
    const row = await this.database.orm.AgentSession.where({ conversationId })
      .select('sessionId')
      .first();
    return row?.sessionId;
  }

  async save(conversationId: string, sessionId: string): Promise<void> {
    await this.database.orm.AgentSession.create({ conversationId, sessionId });
  }
}
