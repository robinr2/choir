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
import {
  type LayoutAction,
  layoutActionSchema,
  type Pane,
  paneIdSchema,
} from '../layout/layout.schemas.js';
import {
  WORKSPACE,
  type Workspace,
  type WorkspaceView,
} from './workspace.port.js';
import {
  type ContentRequest,
  contentRequestSchema,
  type RenameRequest,
  renameRequestSchema,
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

  @Post('panes')
  openPane(): Promise<Pane> {
    return this.workspace.openPane(EMPTY);
  }

  @Put('panes/:id/content')
  open(
    @Param('id', ID) id: string,
    @Body({ schema: contentRequestSchema }) { kind }: ContentRequest,
  ): Promise<Pane> {
    return this.workspace.open(id, kind);
  }

  @Post('actions')
  @HttpCode(HttpStatus.NO_CONTENT)
  act(
    @Body({ schema: layoutActionSchema }) action: LayoutAction,
  ): Promise<void> {
    return this.workspace.act(action);
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
