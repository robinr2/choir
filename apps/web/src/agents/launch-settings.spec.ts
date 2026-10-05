import { expect, test } from 'vitest';
import { CATALOG } from '@/test/fake-agents';
import { launchOf } from './launch-settings';

const { models } = CATALOG;

test('launches with the chosen folder, model, effort and mode', () => {
  expect(
    launchOf(
      '/home/sam',
      { model: 'default', effort: 'low', mode: 'plan' },
      models,
    ),
  ).toEqual({
    cwd: '/home/sam',
    model: 'default',
    effort: 'low',
    mode: 'plan',
  });
});

test('leaves out an effort the chosen model does not offer', () => {
  expect(
    launchOf(
      '/home/sam',
      { model: 'haiku', effort: 'low', mode: 'plan' },
      models,
    ),
  ).toEqual({ cwd: '/home/sam', model: 'haiku', mode: 'plan' });
  expect(
    launchOf(
      '/home/sam',
      { model: 'default', effort: 'max', mode: 'plan' },
      models,
    ),
  ).toEqual({ cwd: '/home/sam', model: 'default', mode: 'plan' });
});

test('leaves the model and effort to the agent when none is chosen', () => {
  expect(
    launchOf(
      '/home/sam',
      { model: null, effort: null, mode: 'default' },
      models,
    ),
  ).toEqual({ cwd: '/home/sam', mode: 'default' });
  expect(
    launchOf('/', { model: 'default', effort: null, mode: 'default' }, models),
  ).toEqual({ cwd: '/', model: 'default', mode: 'default' });
});
