import { afterEach, beforeEach, vi } from 'vitest';
import { fakeCore } from './fake-core';
import { requests } from './fake-event-source';
import { coreHasInbox } from './fake-inbox';
import { dragEvent, pane, renderApp, type Screen } from './render-app';

type Inbox = Parameters<typeof coreHasInbox>[0];

export function withFakeCore(): void {
  beforeEach(() => {
    fakeCore();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

export async function openInbox(screen: Screen, list?: string) {
  await screen.getByRole('button', { name: 'Inbox' }).click();
  const inbox = screen.getByRole('complementary', { name: 'Inbox' });
  if (list) await inbox.getByRole('button', { name: list }).click();
  return inbox;
}

export async function showInbox(data: Inbox, list?: string) {
  coreHasInbox(data);
  const screen = await renderApp();
  return { screen, inbox: await openInbox(screen, list) };
}

export async function openEntry(screen: Screen, title: string) {
  const inbox = screen.getByRole('complementary', { name: 'Inbox' });
  await inbox.getByRole('button', { name: new RegExp(title) }).click();
  return screen.getByRole('dialog', { name: title });
}

export function rowOf(screen: Screen, title: string): HTMLElement {
  const article = screen.container.querySelector(
    `article[aria-label="${title}"]`,
  );
  const row = article?.parentElement;
  if (!row) throw new Error(`${title} is not in a row`);
  return row;
}

export function dragFrom(screen: Screen, title: string): DataTransfer {
  const data = new DataTransfer();
  rowOf(screen, title).dispatchEvent(dragEvent('dragstart', data));
  return data;
}

export function agentZone(screen: Screen, name: string) {
  const input = pane(screen, name).getByRole('textbox');
  const zone = input.element().closest('[data-todo-target]');
  if (!zone) throw new Error('The agent takes no to-dos');
  return { input, zone };
}

export function changes() {
  return requests().filter(
    ([url, method]) => method !== 'GET' && !url.startsWith('/events/'),
  );
}

export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
