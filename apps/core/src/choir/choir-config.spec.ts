import { z } from 'zod';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  canvasDir,
  choirConfigFrom,
  defaultFolder,
  profileDir,
  sessionFolder,
  sessionsDir,
} from './choir-config.js';

describe('choirConfigFrom', () => {
  it('keeps choir data in the local share folder, serves on port 3000 and draws on port 3100', () => {
    expect(choirConfigFrom({})).toEqual({
      dataDir: path.join(homedir(), '.local', 'share', 'choir'),
      projectDir: undefined,
      coreUrl: 'http://localhost:3000',
      canvasUrl: 'http://127.0.0.1:3100',
    });
  });

  it('reads the data folder, the project and the ports from the environment', () => {
    expect(
      choirConfigFrom({
        CHOIR_DATA_DIR: '/data',
        CHOIR_PROJECT_DIR: '/project',
        PORT: '3100',
        CHOIR_CANVAS_PORT: '3200',
      }),
    ).toEqual({
      dataDir: '/data',
      projectDir: '/project',
      coreUrl: 'http://localhost:3100',
      canvasUrl: 'http://127.0.0.1:3200',
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
  });
});

describe('choir folders', () => {
  const config = {
    dataDir: '/data',
    coreUrl: 'http://localhost:3000',
    canvasUrl: 'http://127.0.0.1:3100',
  };

  it('lays out the profile, the default folder, the saved sessions and the canvas', () => {
    expect(profileDir(config)).toBe('/data/profiles/default');
    expect(defaultFolder(config)).toBe('/data/default');
    expect(sessionsDir(config)).toBe('/data/sessions');
    expect(canvasDir(config)).toBe('/data/canvas');
  });

  it('runs sessions in the project when there is one', () => {
    expect(sessionFolder(config)).toBe('/data/default');
    expect(sessionFolder({ ...config, projectDir: '/project' })).toBe(
      '/project',
    );
  });
});
