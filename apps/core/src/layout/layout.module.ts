import { Module } from '@nestjs/common';
import { LayoutService } from './layout.service.js';
import { LayoutStore } from './layout.store.js';

@Module({
  providers: [LayoutStore, LayoutService],
  exports: [LayoutService],
})
export class LayoutModule {}
