import type {
  NewSessionRequest,
  SessionConfigOption,
  SetSessionConfigOptionRequest,
} from '@agentclientprotocol/sdk';
import { z } from 'zod';

export type Config = {
  mode: string;
  model: string;
  effort: string;
  fast: boolean;
};

const MODES = [
  { value: 'default', name: 'Manual', description: 'Always ask' },
  { value: 'plan', name: 'Plan' },
  {
    value: 'bypassPermissions',
    name: 'Bypass permissions',
    description: 'Accepts all permissions',
  },
];

const MODELS = [
  {
    group: 'recommended',
    name: 'Recommended',
    options: [{ value: 'default', name: 'Default', description: 'Opus 4.8' }],
  },
  {
    group: 'other',
    name: 'Other',
    options: [
      { value: 'opus', name: 'Opus 4.8', description: 'Most capable' },
      { value: 'haiku', name: 'Haiku 4.5' },
    ],
  },
];

const EFFORTS: Record<string, string[]> = {
  default: ['default', 'low', 'high'],
  opus: ['default', 'low', 'medium', 'high', 'max'],
  haiku: [],
};

const optionsSchema = z
  .object({
    _meta: z.object({
      claudeCode: z.object({
        options: z.object({
          model: z.string().optional(),
          effort: z.string().optional(),
        }),
      }),
    }),
  })
  .transform(({ _meta: meta }) => meta.claudeCode.options);

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function supported(model: string, effort: string): string {
  return EFFORTS[model]?.includes(effort) ? effort : 'default';
}

export function initialConfig(setup: NewSessionRequest): Config {
  const parsed = optionsSchema.safeParse(setup);
  const { model = 'default', effort = 'default' } = parsed.success
    ? parsed.data
    : {};
  return {
    mode: 'default',
    model,
    effort: supported(model, effort),
    fast: false,
  };
}

export function configured(
  config: Config,
  { configId, value }: SetSessionConfigOptionRequest,
): Config {
  if (!(configId in config)) throw new Error(`Unknown option ${configId}`);
  const next = { ...config, [configId]: value };
  return { ...next, effort: supported(next.model, next.effort) };
}

function effortOption(config: Config): SessionConfigOption[] {
  const efforts = EFFORTS[config.model] ?? [];
  if (efforts.length === 0) return [];
  return [
    {
      id: 'effort',
      name: 'Effort',
      category: 'thought_level',
      type: 'select',
      currentValue: config.effort,
      options: efforts.map((value) => ({ value, name: title(value) })),
    },
  ];
}

export function configOptions(config: Config): SessionConfigOption[] {
  return [
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: config.mode,
      options: MODES,
    },
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: config.model,
      options: MODELS,
    },
    ...effortOption(config),
    {
      id: 'fast',
      name: 'Fast mode',
      type: 'boolean',
      currentValue: config.fast,
    },
  ];
}
