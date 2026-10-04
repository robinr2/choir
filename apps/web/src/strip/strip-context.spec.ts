import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useStrip } from './strip-context';

test('needs a strip to lay panes out', async () => {
  vi.spyOn(console, 'error').mockReturnValue();
  await expect(renderHook(() => useStrip())).rejects.toThrow(
    'useStrip needs a StripContext',
  );
});
