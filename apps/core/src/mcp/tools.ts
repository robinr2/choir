import type { McpServer } from '@modelcontextprotocol/server';
import type { ListQuery } from '../inbox/listing.js';
import type {
  LinkedFile,
  NotificationDetail,
  NotificationSummary,
} from '../inbox/notification-views.js';
import type { NewTodo, TodoChange } from '../inbox/todo-input.js';
import type {
  GrabbedTodo,
  TodoDetail,
  TodoSummary,
} from '../inbox/todo-views.js';
import type { Workspace } from '../workspace/workspace.port.js';

type Notifications = {
  list(query: ListQuery): Promise<NotificationSummary[]>;
  detail(id: string): Promise<NotificationDetail>;
  attachments(ids: readonly string[]): Promise<LinkedFile[]>;
  setArchived(id: string, archived: boolean): Promise<void>;
};

type Todos = {
  list(query: ListQuery): Promise<TodoSummary[]>;
  create(todo: NewTodo): Promise<TodoDetail>;
  update(id: string, change: TodoChange): Promise<TodoDetail>;
  link(id: string, notificationId: string): Promise<TodoDetail>;
  grab(id: string): Promise<GrabbedTodo>;
};

export type ChoirServices = {
  workspace: Workspace;
  notifications: Notifications;
  todos: Todos;
  coreUrl: string;
};

export type ToolContext = ChoirServices & { callerId: string };

export type Tool = (server: McpServer, context: ToolContext) => void;

export function reply(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}
