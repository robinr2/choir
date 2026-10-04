import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { AgentCatalog, SessionListing } from './agent-catalog.js';
import { AgentCatalogService } from './agent-catalog.service.js';

@Controller()
export class AgentCatalogController {
  constructor(private readonly catalog: AgentCatalogService) {}

  @Get('agent-catalog')
  agentCatalog(): Promise<AgentCatalog> {
    return this.catalog.catalog();
  }

  @Get('agent-sessions')
  sessions(): Promise<SessionListing[]> {
    return this.catalog.sessions();
  }

  @Delete('agent-sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('sessionId', ParseUUIDPipe) sessionId: string): Promise<void> {
    return this.catalog.delete(sessionId);
  }
}
