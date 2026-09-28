import { Global, Module } from '@nestjs/common';
import { InboxController } from './inbox.controller.js';
import { InboxCountsService } from './inbox-counts.js';
import { InboxEvents } from './inbox-events.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { TodosController } from './todos.controller.js';
import { TodosService } from './todos.service.js';

@Global()
@Module({
  controllers: [InboxController, NotificationsController, TodosController],
  providers: [
    InboxEvents,
    InboxCountsService,
    NotificationsService,
    TodosService,
  ],
  exports: [InboxEvents, NotificationsService, TodosService],
})
export class InboxModule {}
