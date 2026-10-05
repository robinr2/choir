import { send } from '@/lib/live-store';

export type CatalogChoice = {
  value: string;
  name: string;
  description: string | null;
};

export type CatalogModel = CatalogChoice & {
  efforts: { value: string; name: string }[];
};

export type AgentCatalog = {
  models: CatalogModel[];
  modes: CatalogChoice[];
  defaults: {
    cwd: string;
    model: string | null;
    effort: string | null;
    mode: string;
  };
};

export type AgentSession = {
  sessionId: string;
  cwd: string;
  title: string | null;
  updatedAt: string | null;
};

export type FolderListing = {
  path: string;
  parent: string | null;
  folders: { name: string; path: string }[];
};

async function json<T>(response: Promise<Response>): Promise<T> {
  return (await response).json();
}

export class CoreAgents {
  #catalog?: Promise<AgentCatalog>;

  catalog(): Promise<AgentCatalog> {
    this.#catalog ??= json(send('GET', '/agent-catalog'));
    return this.#catalog;
  }

  sessions(): Promise<AgentSession[]> {
    return json(send('GET', '/agent-sessions'));
  }

  async deleteSession(sessionId: string): Promise<void> {
    await send('DELETE', `/agent-sessions/${sessionId}`);
  }

  folders(path: string): Promise<FolderListing> {
    const query = new URLSearchParams({ path });
    return json(send('GET', `/folders?${query}`));
  }
}
