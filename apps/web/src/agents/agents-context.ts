import { createContext, use } from 'react';
import type { CoreAgents } from './core-agents';

export const AgentsContext = createContext<CoreAgents | null>(null);

export function useAgents(): CoreAgents {
  const agents = use(AgentsContext);
  if (!agents) throw new Error('useAgents needs an AgentsContext');
  return agents;
}
