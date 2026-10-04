import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { BehaviorSubject, type Observable } from 'rxjs';
import { layoutChange } from './layout-actions.js';
import type {
  Agent,
  LayoutAction,
  NewPane,
  OpenableKind,
  Pane,
  PaneContent,
  WorkspaceState,
} from './layout.schemas.js';
import { LayoutStore } from './layout.store.js';
import { emptyLayout, updateActiveSpace } from './monitor.js';
import { openPane, paneIds, removePane } from './monitor-panes.js';
import { isSpaceAction, spaceChange } from './space-actions.js';

type Filled = { content: PaneContent; nextNumber: number };

@Injectable()
export class LayoutService implements OnModuleInit {
  private readonly state = new BehaviorSubject<WorkspaceState>({
    layout: emptyLayout(),
    panes: {},
    nextNumber: 1,
  });

  constructor(
    @Inject(LayoutStore)
    private readonly store: Pick<LayoutStore, 'load' | 'save'>,
  ) {}

  async onModuleInit(): Promise<void> {
    const saved = await this.store.load();
    if (saved === undefined) {
      await this.openPane({ kind: 'agent' });
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

  async openPane(added: NewPane): Promise<Pane> {
    const id = randomUUID();
    const { content, nextNumber } = this.filled(added);
    await this.commit({
      layout: openPane(this.current.layout, id),
      panes: { ...this.current.panes, [id]: content },
      nextNumber,
    });
    return { id, ...content };
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

  async act(action: LayoutAction): Promise<void> {
    if ('paneId' in action) this.pane(action.paneId);
    const { layout } = this.current;
    await this.commit({
      ...this.current,
      layout: isSpaceAction(action)
        ? updateActiveSpace(layout, spaceChange(action))
        : layoutChange(layout, action),
    });
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
      layout: removePane(this.current.layout, id),
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

  private commit({ layout, panes, nextNumber }: WorkspaceState) {
    const ordered = paneIds(layout).map((id) => [id, panes[id]]);
    const next = { layout, panes: Object.fromEntries(ordered), nextNumber };
    this.state.next(next);
    return this.store.save(next);
  }
}
