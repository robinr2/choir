import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  type ArchivedChange,
  archivedSchema,
  entryIdSchema,
  type ListQuery,
  listQuerySchema,
  type Placement,
  placementSchema,
} from './listing.js';
import {
  CLOUDEVENTS_JSON,
  type NotificationEvent,
  notificationEventSchema,
} from './notification-event.js';
import type {
  NotificationDetail,
  NotificationSummary,
} from './notification-views.js';
import { NotificationsService } from './notifications.service.js';

const ID = { schema: entryIdSchema };

const INDEX = { schema: z.coerce.number().int().nonnegative() };

function disposition(filename: string): string {
  return `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Post()
  async receive(
    @Headers('content-type') contentType: string | undefined,
    @Body({ schema: notificationEventSchema }) event: NotificationEvent,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<{ id: string }> {
    if (!contentType?.startsWith(CLOUDEVENTS_JSON)) {
      throw new UnsupportedMediaTypeException(
        `Send the notification as ${CLOUDEVENTS_JSON}`,
      );
    }
    const { id, created } = await this.notifications.receive(event);
    response.statusCode = created ? HttpStatus.CREATED : HttpStatus.OK;
    return { id };
  }

  @Get()
  list(
    @Query({ schema: listQuerySchema }) query: ListQuery,
  ): Promise<NotificationSummary[]> {
    return this.notifications.list(query);
  }

  @Get(':id')
  detail(@Param('id', ID) id: string): Promise<NotificationDetail> {
    return this.notifications.detail(id);
  }

  @Get(':id/attachments/:index')
  async attachment(
    @Param('id', ID) id: string,
    @Param('index', INDEX) index: number,
  ): Promise<StreamableFile> {
    const file = await this.notifications.attachment(id, index);
    return new StreamableFile(file.content, {
      type: file.mediaType,
      disposition: disposition(file.filename),
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @Param('id', ID) id: string,
    @Body({ schema: archivedSchema }) { archived }: ArchivedChange,
  ): Promise<void> {
    return this.notifications.setArchived(id, archived);
  }

  @Put(':id/position')
  @HttpCode(HttpStatus.NO_CONTENT)
  move(
    @Param('id', ID) id: string,
    @Body({ schema: placementSchema }) placement: Placement,
  ): Promise<void> {
    return this.notifications.move(id, placement);
  }
}
