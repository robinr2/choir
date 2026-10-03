import { Global, Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { LayoutModule } from '../layout/layout.module.js';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService, workspaceProvider } from './workspace.service.js';
import { WORKSPACE } from './workspace.port.js';

@Global()
@Module({
  imports: [LayoutModule, ConversationsModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, workspaceProvider],
  exports: [WORKSPACE],
})
export class WorkspaceModule {}
