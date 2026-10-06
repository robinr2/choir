import { expect, test, vi } from 'vitest';
import { KeyLayout } from './key-layout';

function navigatorWith(keyboard?: Keyboard): Navigator {
  return Object.create(navigator, { keyboard: { value: keyboard } });
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

test('starts without a layout', () => {
  expect(new KeyLayout(navigatorWith()).getSnapshot().size).toBe(0);
});

test('loads the layout whenever someone subscribes and tells its listeners', async () => {
  const getLayoutMap = vi.fn<Keyboard['getLayoutMap']>();
  const layout = new KeyLayout(navigatorWith({ getLayoutMap }));
  const german = new Map([['BracketLeft', 'ü']]);
  getLayoutMap.mockResolvedValue(german);
  const changed = vi.fn<() => void>();
  const stop = layout.subscribe(changed);
  await vi.waitFor(() => expect(layout.getSnapshot()).toBe(german));
  expect(changed).toHaveBeenCalledOnce();
  stop();
  const swiss = new Map([['BracketLeft', 'è']]);
  getLayoutMap.mockResolvedValue(swiss);
  layout.subscribe(() => {});
  await vi.waitFor(() => expect(layout.getSnapshot()).toBe(swiss));
  expect(changed).toHaveBeenCalledOnce();
});

test('keeps the key names when the browser has no layout to give', async () => {
  const changed = vi.fn<() => void>();
  const missing = new KeyLayout(navigatorWith());
  missing.subscribe(changed);
  const blocked = new KeyLayout(
    navigatorWith({
      getLayoutMap: () => Promise.reject(new DOMException('', 'SecurityError')),
    }),
  );
  blocked.subscribe(changed);
  await pause();
  expect(missing.getSnapshot().size).toBe(0);
  expect(blocked.getSnapshot().size).toBe(0);
  expect(changed).not.toHaveBeenCalled();
});
