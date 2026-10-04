import { Module } from '@nestjs/common';
import { AgentCatalogController } from './agent-catalog.controller.js';
import { AgentCatalogService } from './agent-catalog.service.js';
import { AgentService } from './agent.service.js';
import { AgentLinksStore } from './agent-links.store.js';
import { ProfileService } from './profile.service.js';

@Module({
  controllers: [AgentCatalogController],
  providers: [
    ProfileService,
    AgentLinksStore,
    AgentCatalogService,
    AgentService,
  ],
  exports: [AgentService, ProfileService],
})
export class AgentModule {}
