import { z } from 'zod';
import { entryIdSchema } from '../inbox/listing.js';
import { archiveTools } from './archive-tools.js';
import { grabbed } from './attachment-content.js';
import { reply, type Tool } from './tools.js';

const notificationId = entryIdSchema.describe('The ID of the notification');

const listNotifications: Tool = (server, { notifications }) => {
  server.registerTool(
    'list_notifications',
    {
      description:
        "List the active notifications of the user's inbox in the user's order, each with its ID, source, title, the start of its text, arrival time and archive time.",
      inputSchema: z.object({}),
    },
    async () =>
      reply(await notifications.list({ archived: false, search: '' })),
  );
};

const searchNotifications: Tool = (server, { notifications }) => {
  server.registerTool(
    'search_notifications',
    {
      description:
        'Find the active notifications whose title or text contains the search text, ignoring case. With archived set, search the archived notifications as well.',
      inputSchema: z.object({
        search: z.string().trim().min(1),
        archived: z.boolean().default(false),
      }),
    },
    async ({ search, archived }) =>
      reply(await notifications.list({ archived, search })),
  );
};

const grabNotification: Tool = (server, { notifications, coreUrl }) => {
  server.registerTool(
    'grab_notification',
    {
      description:
        'Get a whole notification: its source, title, full text, link to the original and arrival time, followed by its images and other attachments.',
      inputSchema: z.object({ notificationId }),
    },
    async ({ notificationId: id }) => {
      const notification = await notifications.detail(id);
      return grabbed(
        coreUrl,
        notification,
        await notifications.attachments([id]),
      );
    },
  );
};

export const NOTIFICATION_TOOLS = [
  listNotifications,
  searchNotifications,
  grabNotification,
  ...archiveTools({
    noun: 'notification',
    name: 'notification',
    key: 'notificationId',
    archive: ({ notifications }, id, archived) =>
      notifications.setArchived(id, archived),
  }),
];
