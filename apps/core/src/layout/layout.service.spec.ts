import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { firstValueFrom } from 'rxjs';
import { LayoutService } from './layout.service.js';
import { LayoutStore } from './layout.store.js';

const OTHER = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

let dataDir: string;

function saved(): Promise<unknown> {
  return readFile(
    path.join(dataDir, 'workspaces', 'default.json'),
    'utf8',
  ).then(JSON.parse);
}

async function started(): Promise<LayoutService> {
  const layout = new LayoutService(
    new LayoutStore({ dataDir, coreUrl: 'http://localhost:3000' }),
  );
  await layout.onModuleInit();
  return layout;
}

function firstAgent(layout: LayoutService): string {
  const [id] = Object.keys(layout.current.agents);
  if (!id) throw new Error('No agent');
  return id;
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'choir-layout-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

it('starts a new workspace with one agent and saves it', async () => {
  const layout = await started();
  const id = firstAgent(layout);
  expect(layout.current).toEqual({
    layout: id,
    agents: { [id]: { name: 'agent 1' } },
    nextNumber: 2,
  });
  expect(await saved()).toEqual(layout.current);
  expect(await firstValueFrom(layout.changes)).toEqual(layout.current);
});

it('keeps the saved workspace across restarts', async () => {
  const first = await started();
  const added = await first.addAtEdge('bottom', 'reviewer');
  const second = await started();
  expect(second.current).toEqual(first.current);
  expect(second.agent(added.id)).toEqual({ id: added.id, name: 'reviewer' });
});

it('rejects a saved workspace it cannot read', async () => {
  await mkdir(path.join(dataDir, 'workspaces'));
  await writeFile(path.join(dataDir, 'workspaces', 'default.json'), '{}');
  await expect(started()).rejects.toThrow(/nextNumber/);
});

it('fails when the saved workspace cannot be opened', async () => {
  await mkdir(path.join(dataDir, 'workspaces', 'default.json'), {
    recursive: true,
  });
  await expect(started()).rejects.toThrow(/EISDIR.*read/);
});

it('splits a pane into a new agent with a numbered or given name', async () => {
  const layout = await started();
  const id = firstAgent(layout);
  const right = await layout.split(id, 'vertical');
  const below = await layout.split(right.id, 'horizontal', 'tester');
  expect(right).toEqual({ id: expect.any(String), name: 'agent 2' });
  expect(below.name).toBe('tester');
  expect(layout.current.layout).toEqual({
    type: 'split',
    direction: 'row',
    children: [
      id,
      {
        type: 'split',
        direction: 'column',
        children: [right.id, below.id],
        splitPercentages: [50, 50],
      },
    ],
    splitPercentages: [50, 50],
  });
  expect(layout.current.nextNumber).toBe(4);
  expect(await saved()).toEqual(layout.current);
});

it('refuses to change agents it does not know', async () => {
  const layout = await started();
  const id = firstAgent(layout);
  await expect(layout.split(OTHER, 'vertical')).rejects.toThrow(
    `There is no agent ${OTHER}`,
  );
  await expect(layout.swap(id, OTHER)).rejects.toThrow(OTHER);
  await expect(layout.swap(OTHER, id)).rejects.toThrow(OTHER);
  await expect(layout.rename(OTHER, 'x')).rejects.toThrow(OTHER);
  await expect(layout.remove(OTHER)).rejects.toThrow(OTHER);
  expect(Object.keys(layout.current.agents)).toEqual([id]);
});

it('swaps, renames and closes agents', async () => {
  const layout = await started();
  const id = firstAgent(layout);
  const other = await layout.addAtEdge('right');
  await layout.swap(id, other.id);
  expect(layout.current.layout).toMatchObject({ children: [other.id, id] });
  await layout.rename(id, 'planner');
  expect(layout.agent(id).name).toBe('planner');
  await layout.remove(id);
  expect(layout.current).toEqual({
    layout: other.id,
    agents: { [other.id]: { name: 'agent 2' } },
    nextNumber: 3,
  });
  await layout.remove(other.id);
  expect(layout.current.layout).toBeNull();
  expect(await saved()).toEqual(layout.current);
});

it('resizes panes but keeps the same agents', async () => {
  const layout = await started();
  const id = firstAgent(layout);
  const other = await layout.addAtEdge('left');
  const resized = {
    type: 'split' as const,
    direction: 'row' as const,
    children: [other.id, id],
    splitPercentages: [30, 70],
  };
  await layout.resize(resized);
  expect(layout.current.layout).toEqual(resized);
  await expect(layout.resize(id)).rejects.toThrow(
    'The layout must hold the same agents',
  );
  await layout.resize({
    type: 'split',
    direction: 'row',
    children: [
      {
        type: 'split',
        direction: 'row',
        children: [other.id, id],
        splitPercentages: [50, 50],
      },
    ],
    splitPercentages: [100],
  });
  expect(layout.current.layout).toEqual({
    ...resized,
    splitPercentages: [50, 50],
  });
});

it('saves every change in order', async () => {
  const layout = await started();
  const id = firstAgent(layout);
  await Promise.all([layout.rename(id, 'one'), layout.rename(id, 'two')]);
  expect(await saved()).toMatchObject({ agents: { [id]: { name: 'two' } } });
});

it('keeps saving after a change could not be saved', async () => {
  const layout = await started();
  const id = firstAgent(layout);
  const file = path.join(dataDir, 'workspaces', 'default.json');
  await rm(file);
  await mkdir(file);
  await expect(layout.rename(id, 'lost')).rejects.toThrow(/EISDIR/);
  await rm(file, { recursive: true });
  await layout.rename(id, 'kept');
  expect(await saved()).toMatchObject({ agents: { [id]: { name: 'kept' } } });
});
