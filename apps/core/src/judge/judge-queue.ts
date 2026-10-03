import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Subscription } from 'rxjs';
import { InboxEvents } from '../inbox/inbox-events.js';
import { JUDGE, type Judge } from './judge.port.js';
import {
  JudgeQueueStore,
  type QueuedNotification,
} from './judge-queue.store.js';

const FIRST_RETRY_MS = 60_000;

const LAST_RETRY_MS = 3_600_000;

export function retryDelay(attempts: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** (attempts - 1), LAST_RETRY_MS);
}

@Injectable()
export class JudgeQueue
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(JudgeQueue.name);
  private readonly subscriptions = new Subscription();
  private running?: Promise<void>;
  private again: boolean;
  private stopped = false;

  constructor(
    @Inject(JudgeQueueStore)
    private readonly store: Pick<JudgeQueueStore, 'next' | 'done' | 'retry'>,
    @Inject(JUDGE) private readonly judge: Judge,
    @Inject(InboxEvents) private readonly events: Pick<InboxEvents, 'received'>,
  ) {}

  onApplicationBootstrap(): void {
    this.subscriptions.add(
      this.events.received.subscribe(() => void this.wake()),
    );
    void this.wake();
  }

  @Interval(FIRST_RETRY_MS)
  retryDue(): Promise<void> {
    return this.wake();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    this.subscriptions.unsubscribe();
    await this.running;
  }

  wake(): Promise<void> {
    this.again = true;
    this.running ??= this.drain()
      .catch((error: unknown) => {
        this.logger.error(`The judge queue stopped: ${String(error)}`);
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }

  private async drain(): Promise<void> {
    if (!this.again) return;
    this.again = false;
    await this.judgeDue();
    return this.drain();
  }

  private async judgeDue(): Promise<void> {
    const item = await this.store.next(Temporal.Now.instant());
    if (!item || this.stopped) return;
    await this.work(item);
    return this.judgeDue();
  }

  private async work({
    notificationId,
    attempts,
  }: QueuedNotification): Promise<void> {
    try {
      await this.judge.judge(notificationId);
      await this.store.done(notificationId, Temporal.Now.instant());
    } catch (error) {
      const tries = attempts + 1;
      const dueAt = Temporal.Now.instant().add({
        milliseconds: retryDelay(tries),
      });
      await this.store.retry(notificationId, {
        attempts: tries,
        dueAt,
        error: String(error),
      });
      this.logger.warn(
        `Judging notification ${notificationId} failed: ${String(error)}`,
      );
    }
  }
}
