import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useAgentId, useWorkspace } from './workspace-context';

test('needs a workspace to show agents', async () => {
  vi.spyOn(console, 'error').mockReturnValue();
  await expect(renderHook(() => useWorkspace())).rejects.toThrow(
    'useWorkspace needs a WorkspaceContext',
  );
  await expect(renderHook(() => useAgentId())).rejects.toThrow(
    'useAgentId needs an AgentContext',
  );
});
