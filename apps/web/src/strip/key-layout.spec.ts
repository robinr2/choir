import { expect, test, vi } from 'vitest';
import { KeyLayout } from './key-layout';

function navigatorWith(keyboard?: Keyboard): Navigator {
  return Object.create(navigator, { keyboard: { value: keyboard } });
}

test('starts without a layout', () => {
  expect(new KeyLayout(navigatorWith()).getSnapshot().size).toBe(0);
});

test('loads the layout and tells its listeners', async () => {
  const german = new Map([['BracketLeft', 'ü']]);
  const layout = new KeyLayout(
    navigatorWith({ getLayoutMap: () => Promise.resolve(german) }),
  );
  const changed = vi.fn<() => void>();
  const stop = layout.subscribe(changed);
  await layout.load();
  expect(layout.getSnapshot()).toBe(german);
  expect(changed).toHaveBeenCalledOnce();
  stop();
  await layout.load();
  expect(changed).toHaveBeenCalledOnce();
});

test('keeps the key names when the browser has no layout to give', async () => {
  const changed = vi.fn<() => void>();
  const missing = new KeyLayout(navigatorWith());
  missing.subscribe(changed);
  await missing.load();
  const blocked = new KeyLayout(
    navigatorWith({
      getLayoutMap: () => Promise.reject(new DOMException('', 'SecurityError')),
    }),
  );
  blocked.subscribe(changed);
  await blocked.load();
  expect(missing.getSnapshot().size).toBe(0);
  expect(blocked.getSnapshot().size).toBe(0);
  expect(changed).not.toHaveBeenCalled();
});
