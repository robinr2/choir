import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { renderApp } from '@/test/render-app';
import { press, setUpStripScreen, stripElement } from '@/test/strip-screen';

setUpStripScreen();

const HINT = '[data-slot="key-hint"]';

function hint(): HTMLElement | null {
  return document.querySelector<HTMLElement>(HINT);
}

function keydown(init: KeyboardEventInit): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
  );
}

function holdAlt(): void {
  keydown({ key: 'Alt', code: 'AltLeft', altKey: true });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shown(): Promise<HTMLElement> {
  return vi.waitFor(() => {
    const sheet = hint();
    if (!sheet) throw new Error('The key hint is not shown');
    return sheet;
  });
}

async function hidden(): Promise<void> {
  await vi.waitFor(() => expect(hint()).toBeNull());
}

test('shows the key bindings once Alt is held on its own', async () => {
  await renderApp();
  holdAlt();
  await pause(200);
  expect(hint()).toBeNull();
  const sheet = await shown();
  expect(sheet).toHaveTextContent('Column left');
  expect(sheet).toHaveTextContent('Toggle overview');
  expect(sheet).not.toHaveTextContent('Close overview');
  expect(sheet).toHaveAttribute('aria-hidden', 'true');
  expect(getComputedStyle(sheet).pointerEvents).toBe('none');
  await expect.element(page.getByText('Focus', { exact: true })).toBeVisible();
});

test('sits along the bottom of the strip, at most a third of it high', async () => {
  await renderApp();
  holdAlt();
  const sheet = await shown();
  await vi.waitFor(() => {
    const box = sheet.getBoundingClientRect();
    const strip = stripElement().getBoundingClientRect();
    expect(box.bottom).toBeCloseTo(strip.bottom, 0);
    expect(box.left).toBe(strip.left);
    expect(box.width).toBe(strip.width);
    expect(box.height).toBeLessThanOrEqual(strip.height / 3);
  });
});

test('keeps its full size when the bindings fit', async () => {
  await page.viewport(2400, 1400);
  await renderApp();
  holdAlt();
  const sheet = await shown();
  expect(sheet.style.zoom).toBe('1');
});

test('shrinks until every binding fits a third of a small strip', async () => {
  await page.viewport(900, 600);
  await renderApp();
  holdAlt();
  const sheet = await shown();
  await vi.waitFor(() => {
    expect(Number(sheet.style.zoom)).toBeLessThan(1);
    const height = stripElement().getBoundingClientRect().height;
    expect(sheet.getBoundingClientRect().height).toBeLessThanOrEqual(
      height / 3,
    );
  });
});

test('hides when another key joins Alt', async () => {
  await renderApp();
  holdAlt();
  await shown();
  await userEvent.keyboard('{Alt>}j{/Alt}');
  await hidden();
  expect(hint()).toBeNull();
});

test('hides on a click without catching it', async () => {
  await renderApp();
  holdAlt();
  await shown();
  expect(press(stripElement(), { x: 100, y: 100 })).toBe(true);
  await hidden();
});

test('lists the overview keys while the overview is open', async () => {
  await renderApp();
  await userEvent.keyboard('{Alt>}o{/Alt}');
  holdAlt();
  const sheet = await shown();
  expect(sheet).toHaveTextContent('Close overview');
  expect(sheet).toHaveTextContent('Esc');
});
