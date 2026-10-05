import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CanvasModule } from './canvas/canvas.module.js';
import { ChoirModule } from './choir/choir.module.js';
import { DatabaseModule } from './database/database.module.js';
import { FoldersModule } from './folders/folders.module.js';
import { InboxModule } from './inbox/inbox.module.js';
import { JudgeModule } from './judge/judge.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ChoirModule,
    DatabaseModule,
    CanvasModule,
    WorkspaceModule,
    FoldersModule,
    InboxModule,
    McpModule,
    JudgeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
  ],
})
export class AppModule {}
