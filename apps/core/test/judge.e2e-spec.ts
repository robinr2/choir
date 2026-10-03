import { DatabaseService } from '../src/database/database.service.js';
import { JudgeQueue } from '../src/judge/judge-queue.js';
import { JudgeQueueStore } from '../src/judge/judge-queue.store.js';
import { TestApp } from './test-app.js';

const testApp = TestApp.use();

function queued(notificationId: string) {
  return testApp.app
    .get(DatabaseService)
    .orm.QueueItem.where({ notificationId })
    .select('attempts', 'dueAt', 'lastError', 'doneAt')
    .first();
}

it('judges every new notification once and takes it off the queue', async () => {
  const id = await testApp.inbox.notify();
  await vi.waitFor(async () =>
    expect((await queued(id))?.doneAt).not.toBeNull(),
  );
  expect(testApp.judged).toHaveBeenCalledExactlyOnceWith(id);
  await testApp.app.get(JudgeQueue).retryDue();
  expect(testApp.judged).toHaveBeenCalledOnce();
});

it('keeps a notification in the queue when the judge fails and judges it again later', async () => {
  testApp.judged.mockRejectedValueOnce(new Error('Usage limit reached'));
  const id = await testApp.inbox.notify();
  await vi.waitFor(async () => expect((await queued(id))?.attempts).toBe(1));
  const failed = await queued(id);
  expect(failed).toMatchObject({
    lastError: 'Error: Usage limit reached',
    doneAt: null,
  });
  expect(failed?.dueAt.epochMilliseconds).toBeGreaterThan(Date.now() + 30_000);
  await testApp.app.get(JudgeQueue).retryDue();
  expect(testApp.judged).toHaveBeenCalledOnce();
  await testApp.app
    .get(DatabaseService)
    .orm.QueueItem.where({ notificationId: id })
    .update({ dueAt: Temporal.Now.instant() });
  await testApp.app.get(JudgeQueue).retryDue();
  expect(testApp.judged).toHaveBeenCalledTimes(2);
  expect((await queued(id))?.doneAt).not.toBeNull();
});

it('schedules only the failed notification again', async () => {
  const fail = Promise.withResolvers<void>();
  testApp.judged.mockImplementationOnce(() => fail.promise);
  const failing = await testApp.inbox.notify({ title: 'first' });
  await vi.waitFor(() => expect(testApp.judged).toHaveBeenCalledOnce());
  const judged = await testApp.inbox.notify({ title: 'second' });
  fail.reject(new Error('Claude Code is not available'));
  await vi.waitFor(async () =>
    expect((await queued(judged))?.doneAt).not.toBeNull(),
  );
  expect(await queued(failing)).toMatchObject({ attempts: 1, doneAt: null });
  expect(await queued(judged)).toMatchObject({ attempts: 0, lastError: null });
});

it('takes each judged notification off the queue on its own', async () => {
  const release = Promise.withResolvers<void>();
  testApp.judged.mockImplementationOnce(() => release.promise);
  const first = await testApp.inbox.notify({ title: 'first' });
  await vi.waitFor(() => expect(testApp.judged).toHaveBeenCalledOnce());
  const second = await testApp.inbox.notify({ title: 'second' });
  release.resolve();
  await vi.waitFor(async () =>
    expect((await queued(second))?.doneAt).not.toBeNull(),
  );
  expect(testApp.judged.mock.calls).toEqual([[first], [second]]);
});

it('changes only the queue entry it is given', async () => {
  testApp.judged.mockRejectedValue(new Error('offline'));
  const [first, second] = await testApp.inbox.each('notifications', [
    'first',
    'second',
  ]);
  await vi.waitFor(async () =>
    expect((await queued(second))?.attempts).toBe(1),
  );
  const store = testApp.app.get(JudgeQueueStore);
  const later = Temporal.Now.instant().add({ hours: 1 });
  await store.retry(second, {
    attempts: 3,
    dueAt: later,
    error: 'Error: busy',
  });
  await store.done(second, Temporal.Now.instant());
  expect(await queued(first)).toMatchObject({
    attempts: 1,
    lastError: 'Error: offline',
    doneAt: null,
  });
  expect(await queued(second)).toMatchObject({
    attempts: 3,
    lastError: 'Error: busy',
  });
});
