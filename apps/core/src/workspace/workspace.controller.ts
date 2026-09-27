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
import { type Pane, paneIdSchema } from '../layout/layout.schemas.js';
import {
  WORKSPACE,
  type Workspace,
  type WorkspaceView,
} from './workspace.port.js';
import {
  type ContentRequest,
  contentRequestSchema,
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

const ID = { schema: paneIdSchema };

const EMPTY = { kind: 'empty' } as const;

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
    @Body({ schema: splitRequestSchema }) { paneId, direction }: SplitRequest,
  ): Promise<Pane> {
    return this.workspace.split(paneId, direction, EMPTY);
  }

  @Post('edges')
  addAtEdge(
    @Body({ schema: edgeRequestSchema }) { edge }: EdgeRequest,
  ): Promise<Pane> {
    return this.workspace.addAtEdge(edge, EMPTY);
  }

  @Put('panes/:id/content')
  open(
    @Param('id', ID) id: string,
    @Body({ schema: contentRequestSchema }) { kind }: ContentRequest,
  ): Promise<Pane> {
    return this.workspace.open(id, kind);
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

  @Patch('panes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  rename(
    @Param('id', ID) id: string,
    @Body({ schema: renameRequestSchema }) { name }: RenameRequest,
  ): Promise<void> {
    return this.workspace.rename(id, name);
  }

  @Delete('panes/:id')
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
