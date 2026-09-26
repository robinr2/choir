import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
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
import type { Agent, SplitKind, WorkspaceState } from './layout.schemas.js';
import { LayoutStore } from './layout.store.js';

const DIRECTIONS = { vertical: 'row', horizontal: 'column' } as const;

@Injectable()
export class LayoutService implements OnModuleInit {
  private readonly state = new BehaviorSubject<WorkspaceState>({
    layout: null,
    agents: {},
    nextNumber: 1,
  });

  constructor(private readonly store: LayoutStore) {}

  async onModuleInit(): Promise<void> {
    const saved = await this.store.load();
    if (saved === undefined) {
      await this.addAtEdge('right');
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

  agent(id: string): Agent {
    const agent = this.current.agents[id];
    if (!agent) throw new NotFoundException(`There is no agent ${id}`);
    return { id, name: agent.name };
  }

  async split(id: string, kind: SplitKind, name?: string): Promise<Agent> {
    this.agent(id);
    return this.add(name, (layout, added) =>
      splitLeaf(layout, id, added, DIRECTIONS[kind]),
    );
  }

  async addAtEdge(edge: Edge, name?: string): Promise<Agent> {
    return this.add(name, (layout, added) => addAtEdge(layout, added, edge));
  }

  async swap(first: string, second: string): Promise<void> {
    this.agent(first);
    this.agent(second);
    await this.commit({
      ...this.current,
      layout: swapLeaves(this.current.layout, first, second),
    });
  }

  async resize(layout: LayoutNode | null): Promise<void> {
    if (!sameLeaves(layout, this.current.layout)) {
      throw new BadRequestException('The layout must hold the same agents');
    }
    await this.commit({ ...this.current, layout: normalizedLayout(layout) });
  }

  async rename(id: string, name: string): Promise<void> {
    this.agent(id);
    const agents = { ...this.current.agents, [id]: { name } };
    await this.commit({ ...this.current, agents });
  }

  async remove(id: string): Promise<void> {
    this.agent(id);
    const { [id]: _removed, ...agents } = this.current.agents;
    await this.commit({
      ...this.current,
      layout: removeLeaf(this.current.layout, id),
      agents,
    });
  }

  private async add(
    name: string | undefined,
    place: (layout: LayoutNode | null, added: string) => LayoutNode,
  ): Promise<Agent> {
    const { layout, agents, nextNumber } = this.current;
    const agent = { id: randomUUID(), name: name ?? `agent ${nextNumber}` };
    await this.commit({
      layout: place(layout, agent.id),
      agents: { ...agents, [agent.id]: { name: agent.name } },
      nextNumber: nextNumber + 1,
    });
    return agent;
  }

  private commit(next: WorkspaceState): Promise<void> {
    this.state.next(next);
    return this.store.save(next);
  }
}
