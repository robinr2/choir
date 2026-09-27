import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { exhaustMap, interval, type Subscription } from 'rxjs';
import { CanvasHistory } from './canvas-history.js';
import { CanvasServer } from './canvas-server.js';
import { ExcalidrawScene } from './excalidraw-scene.js';

export const SAVE_INTERVAL_MS = 300;

@Injectable()
export class CanvasService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(CanvasService.name);
  private saved?: string;
  private seen?: string;
  private saving?: Subscription;

  constructor(
    @Inject(CanvasServer)
    private readonly server: Pick<CanvasServer, 'start' | 'stop' | 'contents'>,
    @Inject(ExcalidrawScene)
    private readonly scene: Pick<
      ExcalidrawScene,
      'connect' | 'close' | 'import' | 'export'
    >,
    @Inject(CanvasHistory)
    private readonly history: Pick<CanvasHistory, 'latest' | 'save'>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.server.start();
    await this.scene.connect();
    await this.restore();
    this.saving = interval(SAVE_INTERVAL_MS)
      .pipe(exhaustMap(() => this.save()))
      .subscribe();
  }

  async onApplicationShutdown(): Promise<void> {
    this.saving?.unsubscribe();
    await this.scene.close();
    await this.server.stop();
  }

  private async restore(): Promise<void> {
    const latest = await this.history.latest();
    if (latest === undefined) return;
    await this.scene.import(latest);
    this.saved = latest;
  }

  private async save(): Promise<void> {
    try {
      const contents = await this.server.contents();
      if (contents === this.seen) return;
      await this.keep(await this.scene.export());
      this.seen = contents;
    } catch (error) {
      this.logger.error(`The canvas could not be saved: ${String(error)}`);
    }
  }

  private async keep(scene: string): Promise<void> {
    if (scene === this.saved) return;
    await this.history.save(scene);
    this.saved = scene;
  }
}
