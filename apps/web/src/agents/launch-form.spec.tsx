import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { CoreAgents } from '@/agents/core-agents';
import { CoreRateLimits } from '@/agents/core-rate-limits';
import App from '@/App';
import { CoreCanvas } from '@/canvas/core-canvas';
import { CoreInbox } from '@/inbox/core-inbox';
import {
  coreHasSessions,
  coreHoldsFolder,
  OTHER_SESSION,
  session,
  SESSION,
} from '@/test/fake-agents';
import {
  A,
  B,
  column,
  coreShowsWorkspace,
  fakeCore,
  strip,
  viewOf,
} from '@/test/fake-core';
import { requests } from '@/test/fake-event-source';
import { client, pane, renderApp, type Screen } from '@/test/render-app';
import { CoreWorkspace } from '@/workspace/core-workspace';

function emptyPane() {
  return viewOf(
    [strip('first', [column('only', [A, B])])],
    [
      { id: A, kind: 'agent', name: 'agent 1', working: false },
      { id: B, kind: 'empty' },
    ],
  );
}

async function openLaunchForm(): Promise<Screen> {
  const screen = await renderApp(emptyPane());
  await pane(screen, 'New pane').getByRole('button', { name: 'Agent' }).click();
  return screen;
}

function form(screen: Screen) {
  return pane(screen, 'New pane');
}

function launched() {
  return requests()
    .filter(([url]) => url === `/workspace/panes/${B}/content`)
    .map(([, , body]) => body);
}

function indentOf(screen: Screen, folder: string): number {
  const row = form(screen)
    .getByRole('button', { name: folder, exact: true })
    .element().parentElement;
  return Number.parseFloat(row?.style.paddingInlineStart ?? '');
}

async function swapServices(screen: Screen) {
  const workspace = new CoreWorkspace();
  const agents = new CoreAgents();
  const stop = workspace.subscribe(() => undefined);
  coreShowsWorkspace(emptyPane());
  await screen.rerender(
    <App
      client={client}
      workspace={workspace}
      canvas={new CoreCanvas()}
      inbox={new CoreInbox()}
      agents={agents}
      rateLimits={new CoreRateLimits()}
    />,
  );
  stop();
  return { workspace, agents };
}

beforeEach(async () => {
  fakeCore();
  await page.viewport(1256, 900);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('starts an agent in the default folder with the default settings', async () => {
  const screen = await openLaunchForm();
  await expect
    .element(form(screen).getByText('/home/sam/choir', { exact: true }))
    .toBeVisible();
  await expect
    .element(form(screen).getByRole('treeitem', { selected: true }))
    .toHaveTextContent(/^choir/);
  await expect
    .element(form(screen).getByRole('combobox', { name: 'Model', exact: true }))
    .toHaveTextContent('Default (Opus)High');
  await expect
    .element(form(screen).getByRole('combobox', { name: 'Mode', exact: true }))
    .toHaveTextContent('Bypass permissions');
  await form(screen).getByRole('button', { name: 'Start' }).click();
  await vi.waitFor(() =>
    expect(launched()).toEqual([
      {
        kind: 'agent',
        launch: {
          cwd: '/home/sam/choir',
          model: 'default',
          effort: 'high',
          mode: 'bypassPermissions',
        },
      },
    ]),
  );
});

test('starts an agent in a folder chosen from the tree with chosen settings', async () => {
  const screen = await openLaunchForm();
  await expect.element(form(screen).getByText('apps')).toBeVisible();
  await form(screen).getByRole('button', { name: 'Collapse choir' }).click();
  await expect.element(form(screen).getByText('apps')).not.toBeInTheDocument();
  await form(screen).getByRole('button', { name: 'Expand notes' }).click();
  await expect.element(form(screen).getByText('No folders')).toBeVisible();
  await expect.element(form(screen).getByText('apps')).not.toBeInTheDocument();
  await form(screen).getByRole('button', { name: 'Expand choir' }).click();
  await expect.element(form(screen).getByText('apps')).toBeVisible();
  expect(indentOf(screen, 'apps')).toBeGreaterThan(indentOf(screen, 'choir'));
  await form(screen).getByRole('button', { name: 'Expand etc' }).click();
  await form(screen)
    .getByRole('button', { name: 'nginx', exact: true })
    .click();
  await expect
    .element(form(screen).getByText('/etc/nginx', { exact: true }))
    .toBeVisible();
  await form(screen)
    .getByRole('combobox', { name: 'Model', exact: true })
    .click();
  await page.getByRole('option', { name: /Haiku/ }).click();
  await form(screen)
    .getByRole('combobox', { name: 'Mode', exact: true })
    .click();
  await page.getByRole('option', { name: 'Plan' }).click();
  await form(screen).getByRole('button', { name: 'Start' }).click();
  await vi.waitFor(() =>
    expect(launched()).toEqual([
      {
        kind: 'agent',
        launch: { cwd: '/etc/nginx', model: 'haiku', mode: 'plan' },
      },
    ]),
  );
});

test('shows the default folder at the bottom of the folder tree', async () => {
  const screen = await openLaunchForm();
  const choir = form(screen).getByRole('button', {
    name: 'choir',
    exact: true,
  });
  await expect.element(choir).toBeVisible();
  const tree = form(screen).getByRole('tree', { name: 'Folder' }).element();
  const row = choir.element();
  await vi.waitFor(() => expect(tree.scrollTop).toBeGreaterThan(0));
  const treeBox = tree.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  expect(rowBox.bottom).toBeLessThanOrEqual(treeBox.bottom);
  expect(rowBox.top - treeBox.top).toBeGreaterThan(treeBox.height / 2);
});

test('scrolls the folder tree with the wheel over a folder name', async () => {
  const screen = await openLaunchForm();
  const folders = form(screen).getByRole('tree', { name: 'Folder' });
  await expect.element(folders).toBeVisible();
  const tree = folders.element();
  await vi.waitFor(() => expect(tree.scrollTop).toBeGreaterThan(40));
  const bottom = tree.scrollTop;
  await form(screen)
    .getByText('sam', { exact: true })
    .wheel({ delta: { y: -20 } });
  await vi.waitFor(() => expect(tree.scrollTop).toBe(bottom - 20));
  await form(screen)
    .getByText('home', { exact: true })
    .wheel({ delta: { y: -20 } });
  await vi.waitFor(() => expect(tree.scrollTop).toBe(bottom - 40));
});

test('shows a folder loading until core lists it', async () => {
  const release = coreHoldsFolder('/etc');
  const screen = await openLaunchForm();
  await form(screen).getByRole('button', { name: 'Expand etc' }).click();
  await expect.element(form(screen).getByText('Loading…')).toBeVisible();
  release();
  await expect
    .element(form(screen).getByRole('button', { name: 'nginx', exact: true }))
    .toBeVisible();
});

test('launches and deletes with the services it was last given', async () => {
  coreHasSessions([session()]);
  const screen = await openLaunchForm();
  await form(screen)
    .getByRole('button', { name: 'Delete Fix the login bug' })
    .click();
  const { workspace, agents } = await swapServices(screen);
  const launch = vi.spyOn(workspace, 'launch');
  const deleteSession = vi.spyOn(agents, 'deleteSession');
  const sessions = vi.spyOn(agents, 'sessions');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await vi.waitFor(() =>
    expect(deleteSession).toHaveBeenCalledExactlyOnceWith(SESSION),
  );
  await vi.waitFor(() => expect(sessions).toHaveBeenCalledOnce());
  coreHasSessions([session()]);
  await form(screen).getByRole('button', { name: 'Start' }).click();
  expect(launch).toHaveBeenCalledOnce();
});

test('resumes and forks with the workspace it was last given', async () => {
  coreHasSessions([session()]);
  const screen = await openLaunchForm();
  await expect
    .element(form(screen).getByRole('button', { name: /^Fix the login bug/ }))
    .toBeVisible();
  const { workspace } = await swapServices(screen);
  const launch = vi.spyOn(workspace, 'launch');
  await form(screen)
    .getByRole('button', { name: /^Fix the login bug/ })
    .click();
  await form(screen)
    .getByRole('button', { name: 'Fork Fix the login bug' })
    .click();
  expect(launch.mock.calls).toEqual([
    [B, { resume: SESSION, cwd: '/home/sam/choir' }],
    [B, { resume: SESSION, cwd: '/home/sam/choir', fork: true }],
  ]);
});

test('changes the thinking effort before starting', async () => {
  const screen = await openLaunchForm();
  await form(screen)
    .getByRole('combobox', { name: 'Model', exact: true })
    .click();
  await page.getByRole('radio', { name: 'Low' }).click();
  await form(screen).getByRole('button', { name: 'Start' }).click();
  await vi.waitFor(() =>
    expect(launched()).toEqual([
      {
        kind: 'agent',
        launch: {
          cwd: '/home/sam/choir',
          model: 'default',
          effort: 'low',
          mode: 'bypassPermissions',
        },
      },
    ]),
  );
});

test('resumes or forks an earlier session in the pane', async () => {
  coreHasSessions([
    session(),
    session({ sessionId: OTHER_SESSION, title: 'Write docs', cwd: '/srv' }),
  ]);
  const screen = await openLaunchForm();
  const sessions = form(screen).getByRole('list', { name: 'Sessions' });
  await expect
    .element(sessions.getByRole('listitem').first())
    .toHaveTextContent(/Fix the login bug/);
  await sessions.getByRole('button', { name: /^Write docs/ }).click();
  await sessions
    .getByRole('button', { name: 'Fork Fix the login bug' })
    .click();
  await vi.waitFor(() =>
    expect(launched()).toEqual([
      { kind: 'agent', launch: { resume: OTHER_SESSION, cwd: '/srv' } },
      {
        kind: 'agent',
        launch: { resume: SESSION, cwd: '/home/sam/choir', fork: true },
      },
    ]),
  );
});

test('deletes a session after asking', async () => {
  coreHasSessions([session()]);
  const screen = await openLaunchForm();
  const remove = form(screen).getByRole('button', {
    name: 'Delete Fix the login bug',
  });
  await remove.click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect
    .element(page.getByText('Delete this session?'))
    .not.toBeInTheDocument();
  await remove.click();
  await expect
    .element(page.getByText('Fix the login bug is removed from Claude Code'))
    .toBeVisible();
  coreHasSessions([]);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.element(form(screen).getByText('No sessions yet')).toBeVisible();
  expect(
    requests().filter(([url]) => url.startsWith('/agent-sessions')),
  ).toEqual([
    ['/agent-sessions', 'GET', undefined],
    [`/agent-sessions/${SESSION}`, 'DELETE', undefined],
    ['/agent-sessions', 'GET', undefined],
  ]);
});

test('shows the newest sessions first, more on demand and those a search finds', async () => {
  coreHasSessions(
    Array.from({ length: 150 }, (_, index) =>
      session({
        sessionId: `s${index}`,
        title: `Session ${index}`,
        cwd: index === 149 ? '/srv/Deploy' : '/home/sam',
      }),
    ),
  );
  const screen = await openLaunchForm();
  const sessions = form(screen).getByRole('list', { name: 'Sessions' });
  await expect.element(sessions.getByText('Session 49')).toBeVisible();
  expect(sessions.getByRole('listitem').elements()).toHaveLength(50);
  await form(screen)
    .getByRole('button', { name: 'Show 50 more of 100' })
    .click();
  await form(screen)
    .getByRole('button', { name: 'Show 50 more of 50' })
    .click();
  expect(sessions.getByRole('listitem').elements()).toHaveLength(150);
  expect(
    form(screen).getByRole('button', { name: /^Show/ }).elements(),
  ).toEqual([]);
  const search = form(screen).getByRole('searchbox', {
    name: 'Search sessions',
  });
  await search.fill('  deploy ');
  await expect
    .element(sessions.getByRole('listitem'))
    .toHaveTextContent(/Session 149/);
  await search.fill('nothing like it');
  await expect
    .element(form(screen).getByText('No sessions match'))
    .toBeVisible();
});
