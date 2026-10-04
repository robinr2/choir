import { Controller, Get, Query } from '@nestjs/common';
import { type FolderQuery, folderQuerySchema } from './folders.schemas.js';
import { type FolderListing, FoldersService } from './folders.service.js';

@Controller('folders')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get()
  list(
    @Query({ schema: folderQuerySchema }) query: FolderQuery,
  ): Promise<FolderListing> {
    return this.folders.list(query.path);
  }
}
