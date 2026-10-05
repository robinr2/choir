import type { MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { EventsService } from './events.service.js';

const A = '0b6f2c9e-3f5d-4a8e-9c1b-2d7e6f5a4b3c';
const B = '7d1e5a2b-9c4f-4e8a-b6d3-1f2a3b4c5d6e';

function feeds() {
  const workspace = new Subject<any>();
  const inbox = new Subject<any>();
  const rateLimits = new Subject<any>();
  const conversations = new Map<string, Subject<any>>();
  const changes = vi.fn<(id: string) => Subject<any>>((id) => {
    const states = new Subject<any>();
    conversations.set(id, states);
    return states;
  });
  const service = new EventsService(
    { changes: workspace },
    { changes: inbox },
    { changes: rateLimits },
    { changes },
  );
  const states = (id: string): Subject<any> => {
    const watched = conversations.get(id);
    if (!watched) throw new Error(`Nobody watches ${id}`);
    return watched;
  };
  return { service, workspace, inbox, rateLimits, states, changes };
}

function connect(service: EventsService) {
  const received: MessageEvent[] = [];
  const subscription = service.stream().subscribe((event) => {
    received.push(event);
  });
  const data: any = received[0]?.data;
  return { id: String(data.id), received, subscription };
}

it('starts every stream with its connection and tags the page-wide events', () => {
  const { service, workspace, inbox, rateLimits } = feeds();
  const { id, received } = connect(service);
  workspace.next({ panes: [] });
  inbox.next({ notifications: 1, todos: 2 });
  rateLimits.next({ windows: [] });
  expect(received).toEqual([
    { type: 'connection', data: { id: expect.any(String) } },
    { type: 'workspace', data: { panes: [] } },
    { type: 'inbox', data: { notifications: 1, todos: 2 } },
    { type: 'rate-limits', data: { windows: [] } },
  ]);
  expect(connect(service).id).not.toBe(id);
});

it('sends the states of the conversations a connection watches', () => {
  const { service, states, changes } = feeds();
  const { id, received } = connect(service);
  expect(service.watch(id, A)).toBe(true);
  expect(service.watch(id, A)).toBe(true);
  expect(service.watch(id, B)).toBe(true);
  expect(changes.mock.calls).toEqual([[A], [B]]);
  states(A).next({ messages: [] });
  states(B).next({ queue: [] });
  expect(service.unwatch(id, A)).toBe(true);
  expect(service.unwatch(id, A)).toBe(true);
  states(A).next({ messages: ['late'] });
  expect(received.slice(1)).toEqual([
    { type: 'conversation', data: { id: A, state: { messages: [] } } },
    { type: 'conversation', data: { id: B, state: { queue: [] } } },
  ]);
  expect(states(A).observed).toBe(false);
  expect(states(B).observed).toBe(true);
});

it('watches a failed conversation again', () => {
  const { service, states, changes } = feeds();
  const { id, received } = connect(service);
  service.watch(id, A);
  states(A).error(new Error('no agent'));
  service.watch(id, A);
  states(A).next({ messages: [] });
  expect(changes).toHaveBeenCalledTimes(2);
  expect(received.at(-1)).toEqual({
    type: 'conversation',
    data: { id: A, state: { messages: [] } },
  });
});

it('forgets a connection and its watches when it closes', () => {
  const { service, workspace, states } = feeds();
  const { id, subscription } = connect(service);
  service.watch(id, A);
  subscription.unsubscribe();
  expect(workspace.observed).toBe(false);
  expect(states(A).observed).toBe(false);
  expect(service.watch(id, B)).toBe(false);
  expect(service.unwatch(id, A)).toBe(false);
});
