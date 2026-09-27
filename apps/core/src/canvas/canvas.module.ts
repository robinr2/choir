import { Module } from '@nestjs/common';
import { CanvasHistory } from './canvas-history.js';
import { CanvasServer } from './canvas-server.js';
import { CanvasController } from './canvas.controller.js';
import { CanvasService } from './canvas.service.js';
import { ExcalidrawScene } from './excalidraw-scene.js';

@Module({
  controllers: [CanvasController],
  providers: [CanvasServer, ExcalidrawScene, CanvasHistory, CanvasService],
})
export class CanvasModule {}
