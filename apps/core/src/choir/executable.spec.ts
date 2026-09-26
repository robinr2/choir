import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findExecutable } from './executable.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'choir-path-'));
  await Promise.all(
    ['plain', 'tools', 'later'].map((folder) => mkdir(path.join(root, folder))),
  );
  await writeFile(path.join(root, 'plain', 'claude'), '');
  await writeFile(path.join(root, 'tools', 'claude'), '');
  await chmod(path.join(root, 'tools', 'claude'), 0o755);
  await writeFile(path.join(root, 'later', 'claude'), '');
  await chmod(path.join(root, 'later', 'claude'), 0o755);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

it('finds the first executable of that name on the search path', () => {
  const searchPath = ['', 'missing', 'plain', 'tools', 'later']
    .map((folder) => (folder ? path.join(root, folder) : ''))
    .join(path.delimiter);
  expect(findExecutable('claude', searchPath)).toBe(
    path.join(root, 'tools', 'claude'),
  );
});

it('finds nothing when no folder holds it', () => {
  expect(findExecutable('claude', path.join(root, 'plain'))).toBeUndefined();
  expect(findExecutable('claude')).toBeUndefined();
});

it('skips folders that are not absolute', () => {
  const relative = path.relative(process.cwd(), path.join(root, 'tools'));
  expect(findExecutable('claude', relative)).toBeUndefined();
});
