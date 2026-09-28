export const TODO_TYPE = 'application/x-choir-todo';

export type DraggedTodo = { id: string; title: string };

export function todoReference({ id, title }: DraggedTodo): string {
  return `To-do "${title}" (ID ${id})`;
}
