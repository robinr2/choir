import { ConflictException, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import type { WorkspaceState } from './layout.schemas.js';
import { LayoutService } from './layout.service.js';
import { sketches } from '../test/sketch.js';

const OTHER = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

function fakeStore(saved?: WorkspaceState) {
  return {
    load: vi.fn<() => Promise<WorkspaceState | undefined>>(async () => saved),
    save: vi.fn<(state: WorkspaceState) => Promise<void>>(
      async () => undefined,
    ),
  };
}

async function started(saved?: WorkspaceState) {
  const store = fakeStore(saved);
  const layout = new LayoutService(store);
  await layout.onModuleInit();
  return { layout, store };
}

function named(layout: LayoutService): string[] {
  return sketches(layout.current.layout).map((text) =>
    Object.entries(layout.current.panes).reduce(
      (sketch, [id, content]) =>
        sketch.replaceAll(
          id,
          content.kind === 'agent' ? content.name : content.kind,
        ),
      text,
    ),
  );
}

it('starts a new workspace with one agent and saves it', async () => {
  const { layout, store } = await started();
  expect(named(layout)).toEqual(['> agent 1*', '']);
  expect(layout.current.nextNumber).toBe(2);
  expect(store.save).toHaveBeenCalledExactlyOnceWith(layout.current);
  expect(await firstValueFrom(layout.changes)).toEqual(layout.current);
});

it('starts from the saved workspace', async () => {
  const { layout: first } = await started();
  const { layout: second, store } = await started(first.current);
  expect(second.current).toBe(first.current);
  expect(store.save).not.toHaveBeenCalled();
});

it('opens panes after the focused column with numbered or given agent names', async () => {
  const { layout } = await started();
  const empty = await layout.openPane({ kind: 'empty' });
  expect(empty).toEqual({ id: expect.any(String), kind: 'empty' });
  const tester = await layout.openPane({ kind: 'agent', name: 'tester' });
  const numbered = await layout.openPane({ kind: 'agent' });
  expect([tester.kind, numbered]).toEqual([
    'agent',
    { id: expect.any(String), kind: 'agent', name: 'agent 3' },
  ]);
  expect(layout.agent(tester.id)).toEqual({ id: tester.id, name: 'tester' });
});

it('opens an agent or Excalidraw in an empty pane only', async () => {
  const { layout } = await started();
  const [agent] = Object.keys(layout.current.panes);
  const empty = await layout.openPane({ kind: 'empty' });
  const other = await layout.openPane({ kind: 'empty' });
  await expect(layout.open(agent, 'agent')).rejects.toThrow(
    new ConflictException(`The pane ${agent} is not empty`),
  );
  expect(await layout.open(empty.id, 'excalidraw')).toEqual({
    id: empty.id,
    kind: 'excalidraw',
  });
  await expect(layout.open(other.id, 'excalidraw')).rejects.toThrow(
    new ConflictException('Excalidraw is already open in another pane'),
  );
  expect(await layout.open(other.id, 'agent')).toEqual({
    id: other.id,
    kind: 'agent',
    name: 'agent 2',
  });
  expect(layout.current.nextNumber).toBe(3);
});

it('applies layout actions and checks the panes they name', async () => {
  const { layout, store } = await started();
  const [agent] = Object.keys(layout.current.panes);
  await layout.openPane({ kind: 'empty' });
  await layout.act({ action: 'focusColumnLeft' });
  expect(named(layout)).toEqual(['> agent 1* | empty', '']);
  await layout.act({ action: 'focusWorkspaceDown' });
  expect(named(layout)).toEqual(['agent 1* | empty', '> ']);
  await layout.act({ action: 'focusPane', paneId: agent });
  expect(named(layout)).toEqual(['> agent 1* | empty', '']);
  expect(store.save).toHaveBeenLastCalledWith(layout.current);
  await expect(
    layout.act({ action: 'focusPane', paneId: OTHER }),
  ).rejects.toThrow(new NotFoundException(`There is no pane ${OTHER}`));
});

it('renames agents and closes panes', async () => {
  const { layout } = await started();
  const [agent] = Object.keys(layout.current.panes);
  const empty = await layout.openPane({ kind: 'empty' });
  await layout.rename(agent, 'reviewer');
  await expect(layout.rename(empty.id, 'x')).rejects.toThrow(
    new NotFoundException(`There is no agent ${empty.id}`),
  );
  await layout.remove(empty.id);
  expect(named(layout)).toEqual(['> reviewer*', '']);
  expect(Object.keys(layout.current.panes)).toEqual([agent]);
  const left = await layout.openPane({ kind: 'empty' });
  await layout.act({ action: 'moveColumnLeft' });
  expect(Object.keys(layout.current.panes)).toEqual([left.id, agent]);
  await expect(layout.remove(empty.id)).rejects.toThrow(
    new NotFoundException(`There is no pane ${empty.id}`),
  );
  expect(() => layout.pane(OTHER)).toThrow(NotFoundException);
});
