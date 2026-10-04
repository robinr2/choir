import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller.js';
import { FoldersService } from './folders.service.js';

@Module({
  controllers: [FoldersController],
  providers: [FoldersService],
})
export class FoldersModule {}
