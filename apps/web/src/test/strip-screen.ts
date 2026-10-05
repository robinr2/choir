import { afterEach, beforeEach, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { fakeCore } from './fake-core';
import { requests } from './fake-event-source';
import { pane, type Screen } from './render-app';

const LEFT = 56;

type At = { x: number; y: number };

function found(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  return element;
}

export function stripElement(): HTMLElement {
  return found('[data-slot="strip"]');
}

export function hintElement(): HTMLElement {
  return found('[data-slot="insert-hint"]');
}

export function press(
  target: Element,
  { x, y }: At,
  init: PointerEventInit = {},
): boolean {
  return target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: LEFT + x,
      clientY: y,
      pointerId: 1,
      ...init,
    }),
  );
}

export function drag(type: string, { x, y }: At, pointerId = 1): void {
  window.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: LEFT + x,
      clientY: y,
      pointerId,
      buttons: type === 'pointermove' ? 1 : 0,
    }),
  );
}

export function actions(): unknown[] {
  return requests()
    .filter(([url]) => url === '/workspace/actions')
    .map(([, , body]) => body);
}

export function boxOf(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

export function watchStyles<T>(read: () => T): { seen: T[]; stop(): void } {
  const seen: T[] = [];
  const observer = new MutationObserver(() => seen.push(read()));
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  });
  return { seen, stop: () => observer.disconnect() };
}

export function setUpStripScreen(): void {
  beforeEach(async () => {
    fakeCore();
    await page.viewport(1256, 800);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

export async function measured(screen: Screen): Promise<void> {
  await vi.waitFor(() =>
    expect(boxOf(pane(screen, 'agent 2').element()).x).toBe(658),
  );
}
