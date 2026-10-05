import { expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useConversation } from '@/conversation/conversation-context';
import { useEvents } from '@/lib/events-context';
import { useAgents } from './agents-context';
import { useRateLimits } from './rate-limits-context';

test('needs the agents, rate limits, events and conversation it shows', async () => {
  vi.spyOn(console, 'error').mockReturnValue();
  await expect(renderHook(() => useAgents())).rejects.toThrow(
    'useAgents needs an AgentsContext',
  );
  await expect(renderHook(() => useRateLimits())).rejects.toThrow(
    'useRateLimits needs a RateLimitsContext',
  );
  await expect(renderHook(() => useEvents())).rejects.toThrow(
    'useEvents needs an EventsContext',
  );
  await expect(renderHook(() => useConversation())).rejects.toThrow(
    'useConversation needs a ConversationContext',
  );
});
