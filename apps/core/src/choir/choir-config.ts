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
  claudeExecutable?: string;
  agentCommand?: string[];
};

const environmentSchema = z.object({
  CHOIR_DATA_DIR: z.string().min(1).optional(),
  CHOIR_PROJECT_DIR: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  CHOIR_CANVAS_PORT: z.coerce.number().int().positive().default(3100),
  CHOIR_CANVAS_PUBLIC_URL: z.url().optional(),
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
  };
}

const APP_ROOT = path.resolve(import.meta.dirname, '..', '..');
const VOICE_PROMPT = 'default-voice-prompt.md';

export const PROFILE_TEMPLATE = path.join(APP_ROOT, 'profile-template');

export const DEFAULT_VOICE_PROMPT = path.join(APP_ROOT, VOICE_PROMPT);

export function profileDir(config: ChoirConfig): string {
  return path.join(config.dataDir, 'profiles', 'default');
}

export function profileVoicePrompt(config: ChoirConfig): string {
  return path.join(profileDir(config), VOICE_PROMPT);
}

export function workspaceFile(config: ChoirConfig): string {
  return path.join(config.dataDir, 'workspaces', 'default.json');
}

export function defaultFolder(config: ChoirConfig): string {
  return path.join(config.dataDir, 'default');
}

export function sessionsDir(config: ChoirConfig): string {
  return path.join(config.dataDir, 'sessions');
}

export function sessionFolder(config: ChoirConfig): string {
  return config.projectDir ?? defaultFolder(config);
}

export function canvasDir(config: ChoirConfig): string {
  return path.join(config.dataDir, 'canvas');
}
