import { expect, test } from 'vitest';
import { pathsTo } from './folder-paths';

test('lists the folders from the root down to a path', () => {
  expect(pathsTo('/')).toEqual(['/']);
  expect(pathsTo('/home/sam/choir')).toEqual([
    '/',
    '/home',
    '/home/sam',
    '/home/sam/choir',
  ]);
  expect(pathsTo('/home/sam/')).toEqual(['/', '/home', '/home/sam']);
});
