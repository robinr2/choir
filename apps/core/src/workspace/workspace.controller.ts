import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  type MessageEvent,
  Param,
  Patch,
  Post,
  Put,
  Sse,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { type Agent, agentIdSchema } from '../layout/layout.schemas.js';
import {
  WORKSPACE,
  type Workspace,
  type WorkspaceView,
} from './workspace.port.js';
import {
  type EdgeRequest,
  edgeRequestSchema,
  type LayoutRequest,
  layoutRequestSchema,
  type RenameRequest,
  renameRequestSchema,
  type SplitRequest,
  splitRequestSchema,
  type SwapRequest,
  swapRequestSchema,
  type VoiceRequest,
  voiceRequestSchema,
} from './workspace.schemas.js';

const ID = { schema: agentIdSchema };

@Controller('workspace')
export class WorkspaceController {
  constructor(@Inject(WORKSPACE) private readonly workspace: Workspace) {}

  @Get()
  view(): Promise<WorkspaceView> {
    return this.workspace.view();
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.workspace.changes.pipe(map((data) => ({ data })));
  }

  @Post('splits')
  split(
    @Body({ schema: splitRequestSchema })
    { agentId, direction, name }: SplitRequest,
  ): Promise<Agent> {
    return this.workspace.split(agentId, direction, name);
  }

  @Post('edges')
  addAtEdge(
    @Body({ schema: edgeRequestSchema }) { edge, name }: EdgeRequest,
  ): Promise<Agent> {
    return this.workspace.addAtEdge(edge, name);
  }

  @Post('swaps')
  @HttpCode(HttpStatus.NO_CONTENT)
  swap(
    @Body({ schema: swapRequestSchema }) { first, second }: SwapRequest,
  ): Promise<void> {
    return this.workspace.swap(first, second);
  }

  @Put('layout')
  @HttpCode(HttpStatus.NO_CONTENT)
  resize(
    @Body({ schema: layoutRequestSchema }) { layout }: LayoutRequest,
  ): Promise<void> {
    return this.workspace.resize(layout);
  }

  @Patch('agents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  rename(
    @Param('id', ID) id: string,
    @Body({ schema: renameRequestSchema }) { name }: RenameRequest,
  ): Promise<void> {
    return this.workspace.rename(id, name);
  }

  @Delete('agents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  close(@Param('id', ID) id: string): Promise<void> {
    return this.workspace.close(id);
  }

  @Put('voice')
  @HttpCode(HttpStatus.NO_CONTENT)
  activateVoice(
    @Body({ schema: voiceRequestSchema }) { agentId }: VoiceRequest,
  ): void {
    this.workspace.activateVoice(agentId);
  }
}
