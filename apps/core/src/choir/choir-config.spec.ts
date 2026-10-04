import { z } from 'zod';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  canvasDir,
  judgeContext,
  judgeFolder,
  judgeProfileDir,
  judgeTranscripts,
  choirConfigFrom,
  defaultFolder,
  profileDir,
  sessionFolder,
} from './choir-config.js';

describe('choirConfigFrom', () => {
  it('keeps choir data in the local share folder, serves on port 3000 and draws on port 3100', () => {
    expect(choirConfigFrom({})).toEqual({
      dataDir: path.join(homedir(), '.local', 'share', 'choir'),
      projectDir: undefined,
      coreUrl: 'http://localhost:3000',
      canvasUrl: 'http://127.0.0.1:3100',
      canvasPublicUrl: 'http://127.0.0.1:3100',
      databaseUrl: 'postgresql://choir:choir@127.0.0.1:5433/choir',
      claudeDir: path.join(homedir(), '.claude'),
    });
  });

  it('reads the data folder, the project and the ports from the environment', () => {
    expect(
      choirConfigFrom({
        CHOIR_DATA_DIR: '/data',
        CHOIR_PROJECT_DIR: '/project',
        PORT: '3100',
        CHOIR_CANVAS_PORT: '3200',
        CHOIR_CANVAS_PUBLIC_URL: 'https://choir.example/canvas',
        DATABASE_URL: 'postgresql://db.example/choir',
        CLAUDE_CONFIG_DIR: '/claude',
      }),
    ).toEqual({
      dataDir: '/data',
      projectDir: '/project',
      coreUrl: 'http://localhost:3100',
      canvasUrl: 'http://127.0.0.1:3200',
      canvasPublicUrl: 'https://choir.example/canvas',
      databaseUrl: 'postgresql://db.example/choir',
      claudeDir: '/claude',
    });
  });

  it('rejects empty folders and ports that are not positive', () => {
    expect(() => choirConfigFrom({ CHOIR_DATA_DIR: '' })).toThrow(z.ZodError);
    expect(() => choirConfigFrom({ CHOIR_PROJECT_DIR: '' })).toThrow(
      z.ZodError,
    );
    expect(() => choirConfigFrom({ PORT: '0' })).toThrow(z.ZodError);
    expect(() => choirConfigFrom({ PORT: '1.5' })).toThrow(z.ZodError);
    expect(() => choirConfigFrom({ CHOIR_CANVAS_PORT: '0' })).toThrow(
      z.ZodError,
    );
    expect(() => choirConfigFrom({ CHOIR_CANVAS_PORT: '1.5' })).toThrow(
      z.ZodError,
    );
    expect(() =>
      choirConfigFrom({ CHOIR_CANVAS_PUBLIC_URL: 'not an address' }),
    ).toThrow(z.ZodError);
  });

  it('rejects an empty Claude folder and a database that is no address', () => {
    expect(() => choirConfigFrom({ CLAUDE_CONFIG_DIR: '' })).toThrow(
      z.ZodError,
    );
    expect(() => choirConfigFrom({ DATABASE_URL: 'not an address' })).toThrow(
      z.ZodError,
    );
  });
});

describe('choir folders', () => {
  const config = {
    dataDir: '/data',
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
    canvasPublicUrl: 'http://127.0.0.1:3100',
    databaseUrl: 'postgresql://localhost/choir',
    claudeDir: '/claude',
  };

  it('lays out the profile, the default folder and the canvas', () => {
    expect(profileDir(config)).toBe('/data/profiles/default');
    expect(defaultFolder(config)).toBe('/data/default');
    expect(canvasDir(config)).toBe('/data/canvas');
  });

  it('lays out the judge profile, its folder and the transcripts Claude Code keeps of it', () => {
    expect(judgeProfileDir(config)).toBe('/data/profiles/judge');
    expect(judgeContext(config)).toBe('/data/profiles/judge/judge-context.md');
    expect(judgeFolder(config)).toBe('/data/judge');
    expect(judgeTranscripts({ ...config, dataDir: '/my data.1' })).toBe(
      '/claude/projects/-my-data-1-judge',
    );
  });

  it('runs sessions in the project when there is one', () => {
    expect(sessionFolder(config)).toBe('/data/default');
    expect(sessionFolder({ ...config, projectDir: '/project' })).toBe(
      '/project',
    );
  });
});
