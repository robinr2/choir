import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { LayoutService } from './layout.service.js';
import { LayoutStore } from './layout.store.js';

const OTHER = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

const AGENT = { kind: 'agent' } as const;

const EMPTY = { kind: 'empty' } as const;

let dataDir: string;

function workspaceFile(): string {
  return path.join(dataDir, 'workspaces', 'default.json');
}

function saved(): Promise<unknown> {
  return readFile(workspaceFile(), 'utf8').then(JSON.parse);
}

async function started(): Promise<LayoutService> {
  const layout = new LayoutService(
    new LayoutStore({
      dataDir,
      coreUrl: 'http://localhost:3000',
      canvasUrl: 'http://127.0.0.1:3100',
    }),
  );
  await layout.onModuleInit();
  return layout;
}

function firstPane(layout: LayoutService): string {
  const [id] = Object.keys(layout.current.panes);
  if (!id) throw new Error('No pane');
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
  const id = firstPane(layout);
  expect(layout.current).toEqual({
    layout: id,
    panes: { [id]: { kind: 'agent', name: 'agent 1' } },
    nextNumber: 2,
  });
  expect(await saved()).toEqual(layout.current);
  expect(await firstValueFrom(layout.changes)).toEqual(layout.current);
});

it('keeps the saved workspace across restarts', async () => {
  const first = await started();
  const added = await first.addAtEdge('bottom', {
    kind: 'agent',
    name: 'reviewer',
  });
  const second = await started();
  expect(second.current).toEqual(first.current);
  expect(second.agent(added.id)).toEqual({ id: added.id, name: 'reviewer' });
});

it('reads a workspace saved when every pane was an agent', async () => {
  await mkdir(path.join(dataDir, 'workspaces'));
  await writeFile(
    workspaceFile(),
    JSON.stringify({
      layout: OTHER,
      agents: { [OTHER]: { name: 'planner' } },
      nextNumber: 5,
    }),
  );
  const layout = await started();
  expect(layout.current).toEqual({
    layout: OTHER,
    panes: { [OTHER]: { kind: 'agent', name: 'planner' } },
    nextNumber: 5,
  });
});

it('rejects a saved workspace it cannot read', async () => {
  await mkdir(path.join(dataDir, 'workspaces'));
  await writeFile(workspaceFile(), '{}');
  await expect(started()).rejects.toThrow(/nextNumber/);
});

it('fails when the saved workspace cannot be opened', async () => {
  await mkdir(workspaceFile(), { recursive: true });
  await expect(started()).rejects.toThrow(/EISDIR.*read/);
});

it('splits a pane into a new agent with a numbered or given name', async () => {
  const layout = await started();
  const id = firstPane(layout);
  const right = await layout.split(id, 'vertical', AGENT);
  const below = await layout.split(right.id, 'horizontal', {
    kind: 'agent',
    name: 'tester',
  });
  expect(right).toEqual({
    id: expect.any(String),
    kind: 'agent',
    name: 'agent 2',
  });
  expect(below).toMatchObject({ kind: 'agent', name: 'tester' });
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

it('adds empty panes without using up an agent number', async () => {
  const layout = await started();
  const id = firstPane(layout);
  const split = await layout.split(id, 'vertical', EMPTY);
  const edge = await layout.addAtEdge('top', EMPTY);
  expect(split).toEqual({ id: expect.any(String), kind: 'empty' });
  expect(edge).toEqual({ id: expect.any(String), kind: 'empty' });
  expect(layout.current.panes[split.id]).toEqual(EMPTY);
  expect(layout.current.nextNumber).toBe(2);
  expect(layout.pane(edge.id)).toEqual({ id: edge.id, kind: 'empty' });
  expect(() => layout.agent(edge.id)).toThrow(`There is no agent ${edge.id}`);
});

it('opens an agent or Excalidraw in an empty pane', async () => {
  const layout = await started();
  const left = await layout.addAtEdge('left', EMPTY);
  const right = await layout.addAtEdge('right', EMPTY);
  expect(await layout.open(left.id, 'agent')).toEqual({
    id: left.id,
    kind: 'agent',
    name: 'agent 2',
  });
  expect(await layout.open(right.id, 'excalidraw')).toEqual({
    id: right.id,
    kind: 'excalidraw',
  });
  expect(layout.current.nextNumber).toBe(3);
  expect(layout.current.panes[right.id]).toEqual({ kind: 'excalidraw' });
  expect(await saved()).toEqual(layout.current);
});

it('opens only empty panes and Excalidraw in only one of them', async () => {
  const layout = await started();
  const id = firstPane(layout);
  const first = await layout.addAtEdge('left', EMPTY);
  const second = await layout.addAtEdge('right', EMPTY);
  await expect(layout.open(id, 'excalidraw')).rejects.toThrow(
    new ConflictException(`The pane ${id} is not empty`),
  );
  await expect(layout.open(OTHER, 'agent')).rejects.toThrow(
    new NotFoundException(`There is no pane ${OTHER}`),
  );
  await layout.open(first.id, 'excalidraw');
  await expect(layout.open(second.id, 'excalidraw')).rejects.toThrow(
    new ConflictException('Excalidraw is already open in another pane'),
  );
  await layout.open(second.id, 'agent');
  await layout.remove(first.id);
  const third = await layout.addAtEdge('bottom', EMPTY);
  await layout.open(third.id, 'excalidraw');
  expect(layout.current.panes[third.id]).toEqual({ kind: 'excalidraw' });
});

it('refuses to change panes it does not know', async () => {
  const layout = await started();
  const id = firstPane(layout);
  await expect(layout.split(OTHER, 'vertical', AGENT)).rejects.toThrow(
    `There is no pane ${OTHER}`,
  );
  await expect(layout.swap(id, OTHER)).rejects.toThrow(OTHER);
  await expect(layout.swap(OTHER, id)).rejects.toThrow(OTHER);
  await expect(layout.rename(OTHER, 'x')).rejects.toThrow(OTHER);
  await expect(layout.remove(OTHER)).rejects.toThrow(OTHER);
  expect(Object.keys(layout.current.panes)).toEqual([id]);
});

it('renames only agents', async () => {
  const layout = await started();
  const canvas = await layout.addAtEdge('right', EMPTY);
  await layout.open(canvas.id, 'excalidraw');
  await expect(layout.rename(canvas.id, 'x')).rejects.toThrow(
    new NotFoundException(`There is no agent ${canvas.id}`),
  );
  expect(layout.current.panes[canvas.id]).toEqual({ kind: 'excalidraw' });
});

it('swaps, renames and closes panes', async () => {
  const layout = await started();
  const id = firstPane(layout);
  const other = await layout.addAtEdge('right', AGENT);
  const empty = await layout.addAtEdge('right', EMPTY);
  await layout.swap(id, other.id);
  expect(layout.current.layout).toMatchObject({
    children: [other.id, id, empty.id],
  });
  await layout.rename(id, 'planner');
  expect(layout.agent(id).name).toBe('planner');
  await layout.remove(id);
  await layout.remove(empty.id);
  expect(layout.current).toEqual({
    layout: other.id,
    panes: { [other.id]: { kind: 'agent', name: 'agent 2' } },
    nextNumber: 3,
  });
  await layout.remove(other.id);
  expect(layout.current.layout).toBeNull();
  expect(await saved()).toEqual(layout.current);
});

it('resizes panes but keeps the same panes', async () => {
  const layout = await started();
  const id = firstPane(layout);
  const other = await layout.addAtEdge('left', EMPTY);
  const resized = {
    type: 'split' as const,
    direction: 'row' as const,
    children: [other.id, id],
    splitPercentages: [30, 70],
  };
  await layout.resize(resized);
  expect(layout.current.layout).toEqual(resized);
  await expect(layout.resize(id)).rejects.toThrow(
    'The layout must hold the same panes',
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
  const id = firstPane(layout);
  await Promise.all([layout.rename(id, 'one'), layout.rename(id, 'two')]);
  expect(await saved()).toMatchObject({
    panes: { [id]: { kind: 'agent', name: 'two' } },
  });
});

it('keeps saving after a change could not be saved', async () => {
  const layout = await started();
  const id = firstPane(layout);
  await rm(workspaceFile());
  await mkdir(workspaceFile());
  await expect(layout.rename(id, 'lost')).rejects.toThrow(/EISDIR/);
  await rm(workspaceFile(), { recursive: true });
  await layout.rename(id, 'kept');
  expect(await saved()).toMatchObject({
    panes: { [id]: { kind: 'agent', name: 'kept' } },
  });
});
