import {
  All,
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Req,
  Res,
} from '@nestjs/common';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { agentIdSchema } from '../layout/layout.schemas.js';
import { CALLER_HEADER, orchestrationHandler } from './orchestration-tools.js';
import { WORKSPACE, type Workspace } from './workspace.port.js';

@Controller('mcp')
export class McpController {
  private readonly serve: ReturnType<typeof toNodeHandler>;

  constructor(@Inject(WORKSPACE) workspace: Workspace) {
    this.serve = toNodeHandler(orchestrationHandler(workspace));
  }

  @All()
  async handle(
    @Headers(CALLER_HEADER) caller: string | undefined,
    @Req() request: IncomingMessage & { body?: unknown },
    @Res() response: ServerResponse,
  ): Promise<void> {
    if (!agentIdSchema.safeParse(caller).success) {
      throw new BadRequestException(
        'Name the calling agent in the X-Choir-Agent header',
      );
    }
    await this.serve(request, response, request.body);
  }
}
