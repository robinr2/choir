import { Global, Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { LayoutService } from '../layout/layout.service.js';
import { LayoutStore } from '../layout/layout.store.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService, workspaceProvider } from './workspace.service.js';
import { WORKSPACE } from './workspace.port.js';

@Global()
@Module({
  imports: [AgentModule, ConversationsModule],
  controllers: [WorkspaceController],
  providers: [LayoutStore, LayoutService, WorkspaceService, workspaceProvider],
  exports: [WORKSPACE],
})
export class WorkspaceModule {}
