import { Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { JudgeQueue, retryDelay } from './judge-queue.js';
import type { Judge } from './judge.port.js';
import type {
  JudgeQueueStore,
  QueuedNotification,
} from './judge-queue.store.js';

type Store = Pick<JudgeQueueStore, 'next' | 'done' | 'retry'>;

function fakes(items: QueuedNotification[]) {
  const store = {
    next: vi.fn<Store['next']>(async () => items.shift() ?? null),
    done: vi.fn<Store['done']>(async () => undefined),
    retry: vi.fn<Store['retry']>(async () => undefined),
  };
  const judge = { judge: vi.fn<Judge['judge']>(async () => undefined) };
  const received = new Subject<string>();
  const queue = new JudgeQueue(store, judge, { received });
  return { store, judge, received, queue };
}

it('waits a minute before the first retry, twice as long each time, at most an hour', () => {
  expect([1, 2, 3, 6, 7, 20].map(retryDelay)).toEqual([
    60_000, 120_000, 240_000, 1_920_000, 3_600_000, 3_600_000,
  ]);
});

it('judges the queued notifications when the app starts and when one arrives', async () => {
  const { store, judge, received, queue } = fakes([
    { notificationId: 'n1', attempts: 0 },
  ]);
  queue.onApplicationBootstrap();
  await queue.wake();
  expect(judge.judge).toHaveBeenCalledExactlyOnceWith('n1');
  expect(store.done).toHaveBeenCalledWith('n1', expect.any(Temporal.Instant));
  store.next.mockResolvedValueOnce({ notificationId: 'n2', attempts: 0 });
  received.next('n2');
  await queue.wake();
  expect(judge.judge).toHaveBeenLastCalledWith('n2');
  await queue.onApplicationShutdown();
  received.next('n3');
  expect(store.next).toHaveBeenCalledTimes(6);
});

it('asks for due notifications as of now', async () => {
  const { store, queue } = fakes([]);
  const before = Temporal.Now.instant();
  await queue.retryDue();
  const [asked] = store.next.mock.calls[0] ?? [];
  expect(
    Temporal.Instant.compare(asked ?? before, before),
  ).toBeGreaterThanOrEqual(0);
});

it('schedules a failed notification again, later with every failure', async () => {
  const { store, judge, queue } = fakes([
    { notificationId: 'n1', attempts: 2 },
  ]);
  judge.judge.mockRejectedValueOnce(new Error('usage limit'));
  const warn = vi.spyOn(Logger.prototype, 'warn').mockReturnValue();
  const before = Date.now();
  await queue.retryDue();
  expect(store.done).not.toHaveBeenCalled();
  expect(store.retry).toHaveBeenCalledWith('n1', {
    attempts: 3,
    dueAt: expect.any(Temporal.Instant),
    error: 'Error: usage limit',
  });
  const dueAt = store.retry.mock.calls[0]?.[1].dueAt ?? Temporal.Now.instant();
  expect(dueAt.epochMilliseconds - before).toBeGreaterThanOrEqual(240_000);
  expect(dueAt.epochMilliseconds - Date.now()).toBeLessThanOrEqual(240_000);
  expect(warn).toHaveBeenCalledWith(
    'Judging notification n1 failed: Error: usage limit',
  );
});

it('works through the queue once at a time and again when woken meanwhile', async () => {
  const { store, judge, queue } = fakes([
    { notificationId: 'n1', attempts: 0 },
  ]);
  const judged = Promise.withResolvers<void>();
  judge.judge.mockReturnValueOnce(judged.promise);
  const first = queue.wake();
  await vi.waitFor(() => expect(judge.judge).toHaveBeenCalledOnce());
  store.next.mockResolvedValueOnce({ notificationId: 'n2', attempts: 0 });
  expect(queue.wake()).toBe(first);
  judged.resolve();
  await first;
  expect(judge.judge.mock.calls).toEqual([['n1'], ['n2']]);
  expect(store.next).toHaveBeenCalledTimes(4);
});

it('stops judging when the app shuts down', async () => {
  const { store, judge, queue } = fakes([
    { notificationId: 'n1', attempts: 0 },
    { notificationId: 'n2', attempts: 0 },
  ]);
  const judged = Promise.withResolvers<void>();
  judge.judge.mockReturnValueOnce(judged.promise);
  void queue.wake();
  await vi.waitFor(() => expect(judge.judge).toHaveBeenCalledOnce());
  const stopped = queue.onApplicationShutdown();
  judged.resolve();
  await stopped;
  expect(judge.judge).toHaveBeenCalledOnce();
  await queue.wake();
  expect(store.next).toHaveBeenCalledTimes(3);
  expect(judge.judge).toHaveBeenCalledOnce();
});

it('logs the error when the queue cannot be read', async () => {
  const { store, queue } = fakes([]);
  store.next.mockRejectedValueOnce(new Error('database is down'));
  const error = vi.spyOn(Logger.prototype, 'error').mockReturnValue();
  await queue.wake();
  expect(error).toHaveBeenCalledWith(
    'The judge queue stopped: Error: database is down',
  );
  await queue.wake();
  expect(store.next).toHaveBeenCalledTimes(2);
});
