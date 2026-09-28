import {
  All,
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Req,
  Res,
} from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { paneIdSchema } from '../layout/layout.schemas.js';
import { CALLER_HEADER, MCP_HANDLER, type McpHandler } from './mcp.port.js';

@Controller('mcp')
export class McpController {
  constructor(@Inject(MCP_HANDLER) private readonly serve: McpHandler) {}

  @All()
  async handle(
    @Headers(CALLER_HEADER) caller: string | undefined,
    @Req() request: IncomingMessage & { body?: unknown },
    @Res() response: ServerResponse,
  ): Promise<void> {
    if (!paneIdSchema.safeParse(caller).success) {
      throw new BadRequestException(
        'Name the calling agent in the X-Choir-Agent header',
      );
    }
    await this.serve(request, response, request.body);
  }
}
