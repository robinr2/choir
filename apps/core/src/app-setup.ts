import type { NestExpressApplication } from '@nestjs/platform-express';
import { CLOUDEVENTS_JSON } from './inbox/notification-event.js';

export function setUpApp(app: NestExpressApplication): void {
  app.useBodyParser('json', {
    type: ['application/json', CLOUDEVENTS_JSON],
    limit: '50mb',
  });
}
