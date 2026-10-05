import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { requests } from '@/test/fake-event-source';
import {
  A,
  coreShowsConversation,
  fakeCore,
  said,
  toolCall,
} from '@/test/fake-core';
import { coreReplied, renderChat } from '@/test/render-chat';

beforeEach(() => {
  fakeCore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function write(newText: string) {
  return toolCall(
    't2',
    'Write b.ts',
    {},
    { kind: 'edit', diffs: [{ path: '/work/b.ts', oldText: null, newText }] },
  );
}

test('shows the edits and the file locations of tool calls', async () => {
  const screen = await renderChat(A);
  const read = toolCall(
    't1',
    'Read a.ts',
    {},
    {
      locations: [{ path: '/work/src/a.ts', line: 12 }, { path: '/etc/hosts' }],
      result: 'file text',
    },
  );
  const failed = toolCall(
    't3',
    'Run tests',
    { command: 'npm test' },
    { status: 'failed', isError: true, result: 'tests failed' },
  );
  coreReplied(A, read, write('one\ntwo\n'), failed);
  await screen.getByText('1 tool call').first().click();
  await screen.getByText('1 tool call').last().click();
  const location = screen.getByRole('button', { name: 'src/a.ts:12' });
  await expect.element(location).toHaveAttribute('title', '/work/src/a.ts');
  await location.click();
  await expect
    .element(screen.getByRole('button', { name: '/etc/hosts' }))
    .toBeVisible();
  await expect.element(screen.getByText('b.ts', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('+2', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('two', { exact: true })).toBeVisible();
  await screen.getByRole('button', { name: /Run tests/ }).click();
  await expect.element(screen.getByText('tests failed')).toBeVisible();
  await expect
    .element(screen.getByText('{"command":"npm test"}'))
    .toBeVisible();
  coreReplied(A, read, write('three\n'), failed);
  await expect
    .element(screen.getByText('three', { exact: true }))
    .toBeVisible();
  await expect.element(screen.getByText('+1', { exact: true })).toBeVisible();
});

test('shows subagents as tasks with their timing and transcript', async () => {
  const screen = await renderChat(A);
  coreReplied(
    A,
    toolCall(
      'sub',
      'Agent',
      { description: 'Explore the code', subagent_type: 'fork' },
      {
        kind: 'think',
        timing: { startedAt: 1000, completedAt: 13000 },
        result: 'Found it in a.ts',
        messages: [
          {
            id: 'm0',
            role: 'user',
            parts: [{ type: 'text', text: 'Look around' }],
          },
          {
            id: 'm1',
            role: 'assistant',
            parts: [
              { type: 'reasoning', text: 'Thinking hard' },
              { type: 'text', text: 'Looking now' },
              toolCall(
                'n1',
                'Read c.ts',
                {},
                { locations: [{ path: '/work/c.ts' }] },
              ),
            ],
          },
        ],
      },
    ),
  );
  await expect.element(screen.getByText('fork', { exact: true })).toBeVisible();
  await expect.element(screen.getByText('12s')).toBeVisible();
  await expect.element(screen.getByText('Found it in a.ts')).toBeVisible();
  await screen.getByRole('button', { name: /Explore the code/ }).click();
  await expect.element(screen.getByText('Look around')).toBeVisible();
  await expect.element(screen.getByText('Looking now')).toBeVisible();
  await expect
    .element(screen.getByRole('button', { name: 'c.ts', exact: true }))
    .toBeVisible();
});

test('shows the plan above the composer while the agent works on it', async () => {
  const screen = await renderChat(A);
  const working = { state: 'working', since: 0 } as const;
  coreShowsConversation(A, {
    status: working,
    plan: [
      { content: 'Read the code', status: 'completed' },
      { content: 'Writing the fix', status: 'in_progress' },
      { content: 'Run the tests', status: 'pending' },
    ],
  });
  await expect.element(screen.getByText('1 of 3')).toBeVisible();
  await expect.element(screen.getByText('Writing the fix')).toBeVisible();
  coreShowsConversation(A, {
    status: { state: 'waiting', since: 0 },
    plan: [{ content: 'Reading the code', status: 'in_progress' }],
  });
  await expect.element(screen.getByText('0 of 1')).toBeVisible();
  coreShowsConversation(A, {
    plan: [{ content: 'Reading the code', status: 'in_progress' }],
  });
  await expect
    .element(screen.getByText('Reading the code'))
    .not.toBeInTheDocument();
  coreShowsConversation(A, {
    status: working,
    plan: [{ content: 'Read the code', status: 'completed' }],
  });
  await expect
    .element(screen.getByText('Read the code'))
    .not.toBeInTheDocument();
});

test('lists background forks and opens one next to this pane, even while it runs', async () => {
  const startedAt = Date.now() - 65_000;
  const screen = await renderChat(A);
  const setInterval = vi.spyOn(window, 'setInterval');
  coreShowsConversation(A, {
    forks: [
      {
        id: 'f2',
        sessionId: 's3',
        title: 'Write docs',
        state: 'ready',
        startedAt: 0,
        endedAt: 4000,
      },
    ],
  });
  await expect.element(screen.getByText('0:04')).toBeVisible();
  expect(setInterval).not.toHaveBeenCalledWith(expect.any(Function), 1000);
  coreShowsConversation(A, {
    forks: [
      {
        id: 'f1',
        sessionId: 's2',
        title: 'Try another way',
        state: 'running',
        startedAt,
        endedAt: null,
      },
      {
        id: 'f2',
        sessionId: 's3',
        title: 'Write docs',
        state: 'ready',
        startedAt: 0,
        endedAt: 4000,
      },
    ],
  });
  await expect.element(screen.getByText('Forks')).toBeVisible();
  await expect.element(screen.getByText('0:04')).toBeVisible();
  await expect.element(screen.getByText('1:06')).toBeVisible();
  await screen.getByRole('button', { name: /Try another way/ }).click();
  await vi.waitFor(() =>
    expect(requests()).toContainEqual([
      '/workspace/panes',
      'POST',
      { conversationId: 'f1', nextTo: A },
    ]),
  );
  coreShowsConversation(A, {
    forks: [
      {
        id: 'f1',
        sessionId: 's2',
        title: 'Try another way',
        state: 'failed',
        startedAt,
        endedAt: startedAt + 1000,
      },
    ],
  });
  await expect.element(screen.getByText('0:01')).toBeVisible();
  coreShowsConversation(A);
  await expect.element(screen.getByText('Forks')).not.toBeInTheDocument();
});

test('marks messages steered into a running turn and counts queued images', async () => {
  const screen = await renderChat(A);
  coreShowsConversation(A, {
    status: { state: 'working', since: Date.now() },
    messages: [
      said('m0', 'user', 'Fix it'),
      said('m1', 'assistant', 'On it'),
      said('m2', 'user', 'Also the tests', { steered: true }),
    ],
    queue: [
      { id: 'q1', text: 'Look at this', images: 2 },
      { id: 'q2', text: '', images: 1 },
      { id: 'q3', text: 'No pictures', images: 0 },
    ],
  });
  await expect
    .element(screen.getByText('steered into the running turn'))
    .toBeVisible();
  expect(
    screen.getByText('steered into the running turn').elements(),
  ).toHaveLength(1);
  await expect
    .element(screen.getByLabelText('2 images'))
    .toHaveTextContent('2');
  await expect
    .element(screen.getByLabelText('1 image', { exact: true }))
    .toBeVisible();
});
