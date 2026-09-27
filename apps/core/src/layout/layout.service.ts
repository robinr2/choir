import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { BehaviorSubject, type Observable } from 'rxjs';
import {
  addAtEdge,
  type Edge,
  type LayoutNode,
  normalizedLayout,
  removeLeaf,
  sameLeaves,
  splitLeaf,
  swapLeaves,
} from './layout-tree.js';
import type {
  Agent,
  NewPane,
  OpenableKind,
  Pane,
  PaneContent,
  SplitKind,
  WorkspaceState,
} from './layout.schemas.js';
import { LayoutStore } from './layout.store.js';

const DIRECTIONS = { vertical: 'row', horizontal: 'column' } as const;

type Filled = { content: PaneContent; nextNumber: number };

@Injectable()
export class LayoutService implements OnModuleInit {
  private readonly state = new BehaviorSubject<WorkspaceState>({
    layout: null,
    panes: {},
    nextNumber: 1,
  });

  constructor(private readonly store: LayoutStore) {}

  async onModuleInit(): Promise<void> {
    const saved = await this.store.load();
    if (saved === undefined) {
      await this.addAtEdge('right', { kind: 'agent' });
      return;
    }
    this.state.next(saved);
  }

  get changes(): Observable<WorkspaceState> {
    return this.state.asObservable();
  }

  get current(): WorkspaceState {
    return this.state.value;
  }

  pane(id: string): Pane {
    const content = this.current.panes[id];
    if (!content) throw new NotFoundException(`There is no pane ${id}`);
    return { id, ...content };
  }

  agent(id: string): Agent {
    const content = this.current.panes[id];
    if (content?.kind !== 'agent') {
      throw new NotFoundException(`There is no agent ${id}`);
    }
    return { id, name: content.name };
  }

  async split(id: string, kind: SplitKind, content: NewPane): Promise<Pane> {
    this.pane(id);
    return this.add(content, (layout, added) =>
      splitLeaf(layout, id, added, DIRECTIONS[kind]),
    );
  }

  async addAtEdge(edge: Edge, content: NewPane): Promise<Pane> {
    return this.add(content, (layout, added) => addAtEdge(layout, added, edge));
  }

  async open(id: string, kind: OpenableKind): Promise<Pane> {
    if (this.pane(id).kind !== 'empty') {
      throw new ConflictException(`The pane ${id} is not empty`);
    }
    if (kind === 'excalidraw' && this.showsExcalidraw()) {
      throw new ConflictException('Excalidraw is already open in another pane');
    }
    const { content, nextNumber } = this.filled({ kind });
    const panes = { ...this.current.panes, [id]: content };
    await this.commit({ ...this.current, panes, nextNumber });
    return { id, ...content };
  }

  async swap(first: string, second: string): Promise<void> {
    this.pane(first);
    this.pane(second);
    await this.commit({
      ...this.current,
      layout: swapLeaves(this.current.layout, first, second),
    });
  }

  async resize(layout: LayoutNode | null): Promise<void> {
    if (!sameLeaves(layout, this.current.layout)) {
      throw new BadRequestException('The layout must hold the same panes');
    }
    await this.commit({ ...this.current, layout: normalizedLayout(layout) });
  }

  async rename(id: string, name: string): Promise<void> {
    this.agent(id);
    const panes = {
      ...this.current.panes,
      [id]: { kind: 'agent' as const, name },
    };
    await this.commit({ ...this.current, panes });
  }

  async remove(id: string): Promise<void> {
    this.pane(id);
    const { [id]: _removed, ...panes } = this.current.panes;
    await this.commit({
      ...this.current,
      layout: removeLeaf(this.current.layout, id),
      panes,
    });
  }

  private showsExcalidraw(): boolean {
    return Object.values(this.current.panes).some(
      ({ kind }) => kind === 'excalidraw',
    );
  }

  private filled(content: NewPane | { kind: 'excalidraw' }): Filled {
    const { nextNumber } = this.current;
    if (content.kind !== 'agent') return { content, nextNumber };
    const name = content.name ?? `agent ${nextNumber}`;
    return { content: { kind: 'agent', name }, nextNumber: nextNumber + 1 };
  }

  private async add(
    added: NewPane,
    place: (layout: LayoutNode | null, id: string) => LayoutNode,
  ): Promise<Pane> {
    const id = randomUUID();
    const { content, nextNumber } = this.filled(added);
    await this.commit({
      layout: place(this.current.layout, id),
      panes: { ...this.current.panes, [id]: content },
      nextNumber,
    });
    return { id, ...content };
  }

  private commit(next: WorkspaceState): Promise<void> {
    this.state.next(next);
    return this.store.save(next);
  }
}
