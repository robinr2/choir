import { homedir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';

export const CHOIR_CONFIG = Symbol('ChoirConfig');

export const CHOIR = { name: 'choir', version: '1.0.0' };

export type ChoirConfig = {
  dataDir: string;
  projectDir?: string;
  coreUrl: string;
  canvasUrl: string;
  canvasPublicUrl: string;
  databaseUrl: string;
  claudeDir: string;
  claudeExecutable?: string;
  agentCommand?: string[];
};

const environmentSchema = z.object({
  CHOIR_DATA_DIR: z.string().min(1).optional(),
  CHOIR_PROJECT_DIR: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  CHOIR_CANVAS_PORT: z.coerce.number().int().positive().default(3100),
  CHOIR_CANVAS_PUBLIC_URL: z.url().optional(),
  CLAUDE_CONFIG_DIR: z.string().min(1).optional(),
  DATABASE_URL: z
    .url()
    .default('postgresql://choir:choir@127.0.0.1:5433/choir'),
});

export function choirConfigFrom(environment: NodeJS.ProcessEnv): ChoirConfig {
  const env = environmentSchema.parse(environment);
  const canvasUrl = `http://127.0.0.1:${env.CHOIR_CANVAS_PORT}`;
  return {
    dataDir:
      env.CHOIR_DATA_DIR ?? path.join(homedir(), '.local', 'share', 'choir'),
    projectDir: env.CHOIR_PROJECT_DIR,
    coreUrl: `http://localhost:${env.PORT}`,
    canvasUrl,
    canvasPublicUrl: env.CHOIR_CANVAS_PUBLIC_URL ?? canvasUrl,
    databaseUrl: env.DATABASE_URL,
    claudeDir: env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'),
  };
}

const APP_ROOT = path.resolve(import.meta.dirname, '..', '..');
const VOICE_PROMPT = 'default-voice-prompt.md';

export const PROFILE_TEMPLATE = path.join(APP_ROOT, 'profile-template');

export const DEFAULT_VOICE_PROMPT = path.join(APP_ROOT, VOICE_PROMPT);

const JUDGE_CONTEXT = 'judge-context.md';

export const JUDGE_PROFILE_TEMPLATE = path.join(
  APP_ROOT,
  'judge-profile-template',
);

export const JUDGE_INSTRUCTIONS = path.join(APP_ROOT, 'judge-instructions.md');

export const DEFAULT_JUDGE_CONTEXT = path.join(
  APP_ROOT,
  `default-${JUDGE_CONTEXT}`,
);

export function judgeProfileDir(config: ChoirConfig): string {
  return path.join(config.dataDir, 'profiles', 'judge');
}

export function judgeContext(config: ChoirConfig): string {
  return path.join(judgeProfileDir(config), JUDGE_CONTEXT);
}

export function judgeFolder(config: ChoirConfig): string {
  return path.join(config.dataDir, 'judge');
}

export function judgeTranscripts(config: ChoirConfig): string {
  const project = judgeFolder(config).replaceAll(/[^a-zA-Z0-9]/g, '-');
  return path.join(config.claudeDir, 'projects', project);
}

export function profileDir(config: ChoirConfig): string {
  return path.join(config.dataDir, 'profiles', 'default');
}

export function profileVoicePrompt(config: ChoirConfig): string {
  return path.join(profileDir(config), VOICE_PROMPT);
}

export function defaultFolder(config: ChoirConfig): string {
  return path.join(config.dataDir, 'default');
}

export function sessionFolder(config: ChoirConfig): string {
  return config.projectDir ?? defaultFolder(config);
}

export function canvasDir(config: ChoirConfig): string {
  return path.join(config.dataDir, 'canvas');
}
