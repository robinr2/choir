import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { LayoutModule } from '../layout/layout.module.js';
import { McpController } from './mcp.controller.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService, workspaceProvider } from './workspace.service.js';

@Module({
  imports: [LayoutModule, ConversationsModule],
  controllers: [WorkspaceController, McpController],
  providers: [WorkspaceService, workspaceProvider],
})
export class WorkspaceModule {}
