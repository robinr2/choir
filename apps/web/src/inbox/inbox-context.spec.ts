import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useInbox, useOverlay } from './inbox-context';

test('needs an inbox to show it', async () => {
  vi.spyOn(console, 'error').mockReturnValue();
  await expect(renderHook(() => useInbox())).rejects.toThrow(
    'useInbox needs an InboxContext',
  );
  await expect(renderHook(() => useOverlay())).rejects.toThrow(
    'useOverlay needs an OverlayContext',
  );
});
