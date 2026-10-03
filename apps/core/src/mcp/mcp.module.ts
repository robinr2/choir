import { Module } from '@nestjs/common';
import { CHOIR_CONFIG, type ChoirConfig } from '../choir/choir-config.js';
import { NotificationsService } from '../inbox/notifications.service.js';
import { TodosService } from '../inbox/todos.service.js';
import { WORKSPACE, type Workspace } from '../workspace/workspace.port.js';
import { choirHandler } from './choir-server.js';
import { McpController } from './mcp.controller.js';
import { MCP_HANDLER } from './mcp.port.js';

@Module({
  controllers: [McpController],
  providers: [
    {
      provide: MCP_HANDLER,
      inject: [CHOIR_CONFIG, WORKSPACE, NotificationsService, TodosService],
      useFactory: (
        { coreUrl }: ChoirConfig,
        workspace: Workspace,
        notifications: NotificationsService,
        todos: TodosService,
      ) => choirHandler({ coreUrl, workspace, notifications, todos }),
    },
  ],
})
export class McpModule {}
