import { z } from 'zod';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  choirConfigFrom,
  defaultFolder,
  profileDir,
  sessionFolder,
  sessionsDir,
} from './choir-config.js';

describe('choirConfigFrom', () => {
  it('keeps choir data in the local share folder and serves on port 3000', () => {
    expect(choirConfigFrom({})).toEqual({
      dataDir: path.join(homedir(), '.local', 'share', 'choir'),
      projectDir: undefined,
      coreUrl: 'http://localhost:3000',
    });
  });

  it('reads the data folder, the project and the port from the environment', () => {
    expect(
      choirConfigFrom({
        CHOIR_DATA_DIR: '/data',
        CHOIR_PROJECT_DIR: '/project',
        PORT: '3100',
      }),
    ).toEqual({
      dataDir: '/data',
      projectDir: '/project',
      coreUrl: 'http://localhost:3100',
    });
  });

  it('rejects empty folders and ports that are not positive', () => {
    expect(() => choirConfigFrom({ CHOIR_DATA_DIR: '' })).toThrow(z.ZodError);
    expect(() => choirConfigFrom({ CHOIR_PROJECT_DIR: '' })).toThrow(
      z.ZodError,
    );
    expect(() => choirConfigFrom({ PORT: '0' })).toThrow(z.ZodError);
    expect(() => choirConfigFrom({ PORT: '1.5' })).toThrow(z.ZodError);
  });
});

describe('choir folders', () => {
  const config = { dataDir: '/data', coreUrl: 'http://localhost:3000' };

  it('lays out the profile, the default folder and the saved sessions', () => {
    expect(profileDir(config)).toBe('/data/profiles/default');
    expect(defaultFolder(config)).toBe('/data/default');
    expect(sessionsDir(config)).toBe('/data/sessions');
  });

  it('runs sessions in the project when there is one', () => {
    expect(sessionFolder(config)).toBe('/data/default');
    expect(sessionFolder({ ...config, projectDir: '/project' })).toBe(
      '/project',
    );
  });
});
