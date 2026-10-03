import { z } from 'zod';
import { entryIdSchema } from '../inbox/listing.js';
import { newTodoSchema, todoChangeSchema } from '../inbox/todo-input.js';
import { archiveTools } from './archive-tools.js';
import { grabbed } from './attachment-content.js';
import { reply, type Tool } from './tools.js';

const todoId = entryIdSchema.describe('The ID of the to-do');

const notificationId = entryIdSchema.describe('The ID of the notification');

const DUE_AT =
  'Date and time with its UTC offset in ISO 8601, for example 2026-10-01T17:00:00+02:00';

const listTodos: Tool = (server, { todos }) => {
  server.registerTool(
    'list_todos',
    {
      description:
        "List the active to-dos of the user's inbox in the user's order, each with its ID, title, description, due date, creation and last change.",
      inputSchema: z.object({}),
    },
    async () => reply(await todos.list({ archived: false, search: '' })),
  );
};

const searchTodos: Tool = (server, { todos }) => {
  server.registerTool(
    'search_todos',
    {
      description:
        'Find the active to-dos whose title or description contains the search text, ignoring case. With archived set, search the archived to-dos as well.',
      inputSchema: z.object({
        search: z.string().trim().min(1),
        archived: z.boolean().default(false),
      }),
    },
    async ({ search, archived }) =>
      reply(await todos.list({ archived, search })),
  );
};

const grabTodo: Tool = (server, { todos, coreUrl }) => {
  server.registerTool(
    'grab_todo',
    {
      description:
        'Take a to-do to work on it: this archives the to-do and gives you all of it, its linked notifications and their images and other attachments.',
      inputSchema: z.object({ todoId }),
    },
    async ({ todoId: id }) => {
      const { files, ...todo } = await todos.grab(id);
      return grabbed(coreUrl, todo, files);
    },
  );
};

const createTodo: Tool = (server, { todos }) => {
  server.registerTool(
    'create_todo',
    {
      description:
        "Create a to-do in the user's inbox, from scratch or from a notification it then links to. Returns the new to-do.",
      inputSchema: z.object({
        title: newTodoSchema.shape.title.describe('A short title'),
        description: z.string().default(''),
        dueAt: z.iso.datetime({ offset: true }).optional().describe(DUE_AT),
        notificationId: notificationId.optional(),
      }),
    },
    async ({ title, description, dueAt, notificationId: linked }) =>
      reply(
        await todos.create({
          title,
          description,
          dueAt: dueAt ?? null,
          notificationIds: linked ? [linked] : [],
        }),
      ),
  );
};

const editTodo: Tool = (server, { todos }) => {
  server.registerTool(
    'edit_todo',
    {
      description:
        'Change the title, description or due date of a to-do. Leave out what stays; a null due date removes it. Returns the changed to-do.',
      inputSchema: z.object({
        todoId,
        title: todoChangeSchema.shape.title,
        description: todoChangeSchema.shape.description,
        dueAt: todoChangeSchema.shape.dueAt.describe(DUE_AT),
      }),
    },
    async ({ todoId: id, ...change }) => reply(await todos.update(id, change)),
  );
};

const linkNotification: Tool = (server, { todos }) => {
  server.registerTool(
    'link_notification',
    {
      description:
        'Link a notification to an existing to-do, so the to-do lists it and carries its images and attachments. Returns the to-do.',
      inputSchema: z.object({ todoId, notificationId }),
    },
    async ({ todoId: id, notificationId: linked }) =>
      reply(await todos.link(id, linked)),
  );
};

export const TODO_TOOLS = [
  listTodos,
  searchTodos,
  grabTodo,
  ...archiveTools({
    noun: 'to-do',
    name: 'todo',
    key: 'todoId',
    archive: ({ todos }, id, archived) => todos.update(id, { archived }),
  }),
  createTodo,
  editTodo,
  linkNotification,
];
