import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  entryIdSchema,
  type ListQuery,
  listQuerySchema,
  type Placement,
  placementSchema,
} from './listing.js';
import {
  type Link,
  linkSchema,
  type NewTodo,
  newTodoSchema,
  type TodoChange,
  todoChangeSchema,
} from './todo-input.js';
import type { TodoDetail, TodoSummary } from './todo-views.js';
import { TodosService } from './todos.service.js';

const ID = { schema: entryIdSchema };

@Controller('todos')
export class TodosController {
  constructor(@Inject(TodosService) private readonly todos: TodosService) {}

  @Get()
  list(
    @Query({ schema: listQuerySchema }) query: ListQuery,
  ): Promise<TodoSummary[]> {
    return this.todos.list(query);
  }

  @Post()
  create(@Body({ schema: newTodoSchema }) todo: NewTodo): Promise<TodoDetail> {
    return this.todos.create(todo);
  }

  @Get(':id')
  detail(@Param('id', ID) id: string): Promise<TodoDetail> {
    return this.todos.detail(id);
  }

  @Patch(':id')
  update(
    @Param('id', ID) id: string,
    @Body({ schema: todoChangeSchema }) change: TodoChange,
  ): Promise<TodoDetail> {
    return this.todos.update(id, change);
  }

  @Post(':id/notifications')
  link(
    @Param('id', ID) id: string,
    @Body({ schema: linkSchema }) { notificationId }: Link,
  ): Promise<TodoDetail> {
    return this.todos.link(id, notificationId);
  }

  @Put(':id/position')
  @HttpCode(HttpStatus.NO_CONTENT)
  move(
    @Param('id', ID) id: string,
    @Body({ schema: placementSchema }) placement: Placement,
  ): Promise<void> {
    return this.todos.move(id, placement);
  }
}
