import type {
  SessionConfigOption,
  SessionConfigSelectOption,
  SessionInfo,
} from '@agentclientprotocol/sdk';

export type CatalogEffort = { value: string; name: string };

type CatalogModel = {
  value: string;
  name: string;
  description: string | null;
  efforts: CatalogEffort[];
};

type CatalogMode = {
  value: string;
  name: string;
  description: string | null;
};

export type AgentCatalog = {
  models: CatalogModel[];
  modes: CatalogMode[];
  defaults: {
    cwd: string;
    model: string | null;
    effort: string | null;
    mode: string;
  };
};

export type SessionListing = {
  sessionId: string;
  cwd: string;
  title: string | null;
  updatedAt: string | null;
};

export const MODEL = 'model';

const EFFORT = 'effort';

const MODE = 'mode';

const DEFAULT_MODE = 'bypassPermissions';

function option(options: SessionConfigOption[], id: string) {
  return options.find((candidate) => candidate.id === id);
}

export function choices(
  options: SessionConfigOption[],
  id: string,
): SessionConfigSelectOption[] {
  const found = option(options, id);
  if (found?.type !== 'select') return [];
  return found.options.flatMap((entry) =>
    'group' in entry ? entry.options : [entry],
  );
}

function current(options: SessionConfigOption[], id: string): string | null {
  const found = option(options, id);
  return found?.type === 'select' ? found.currentValue : null;
}

function described({
  value,
  name,
  description,
}: SessionConfigSelectOption): CatalogMode {
  return { value, name, description: description ?? null };
}

function modelOf(
  choice: SessionConfigSelectOption,
  modelEfforts: CatalogEffort[],
): CatalogModel {
  return Object.assign(described(choice), { efforts: modelEfforts });
}

export function efforts(options: SessionConfigOption[]): CatalogEffort[] {
  return choices(options, EFFORT).map(({ value, name }) => ({ value, name }));
}

export function catalogOf(
  options: SessionConfigOption[],
  modelEfforts: CatalogEffort[][],
  cwd: string,
): AgentCatalog {
  return {
    models: choices(options, MODEL).map((model, index) =>
      modelOf(model, modelEfforts[index]),
    ),
    modes: choices(options, MODE).map(described),
    defaults: {
      cwd,
      model: current(options, MODEL),
      effort: current(options, EFFORT),
      mode: DEFAULT_MODE,
    },
  };
}

export function listing({
  sessionId,
  cwd,
  title,
  updatedAt,
}: SessionInfo): SessionListing {
  return { sessionId, cwd, title: title ?? null, updatedAt: updatedAt ?? null };
}
