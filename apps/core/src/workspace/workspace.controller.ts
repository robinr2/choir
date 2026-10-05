import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
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
  type NewPaneRequest,
  newPaneSchema,
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

  @Post('panes')
  openPane(
    @Body({ schema: newPaneSchema }) request: NewPaneRequest,
  ): Promise<Pane> {
    if (!request || !('conversationId' in request)) {
      return this.workspace.openPane(EMPTY);
    }
    return this.workspace.openConversation(
      request.conversationId,
      request.nextTo,
    );
  }

  @Put('panes/:id/content')
  open(
    @Param('id', ID) id: string,
    @Body({ schema: contentRequestSchema }) content: ContentRequest,
  ): Promise<Pane> {
    return this.workspace.open(id, content);
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
