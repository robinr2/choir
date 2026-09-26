import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ChoirModule } from './choir/choir.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';

@Module({
  imports: [ChoirModule, WorkspaceModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
  ],
})
export class AppModule {}
