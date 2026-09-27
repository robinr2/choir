import { Controller, Get, Inject } from '@nestjs/common';
import { CHOIR_CONFIG, type ChoirConfig } from '../choir/choir-config.js';

@Controller('canvas')
export class CanvasController {
  constructor(@Inject(CHOIR_CONFIG) private readonly config: ChoirConfig) {}

  @Get()
  canvas(): { url: string } {
    return { url: this.config.canvasPublicUrl };
  }
}
