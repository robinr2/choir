import { expect, test } from 'vitest';
import { session } from '@/test/fake-agents';
import { lastChange, sessionRows } from './session-rows';

const NOW = Date.parse('2026-10-05T12:00:00Z');

test('tells when a session last changed', () => {
  expect(lastChange(null, NOW)).toBe('');
  expect(lastChange('2026-10-05T11:59:01Z', NOW)).toBe('just now');
  expect(lastChange('2026-10-05T12:00:30Z', NOW)).toBe('just now');
  expect(lastChange('2026-10-05T11:59:00Z', NOW)).toBe('1 minute ago');
  expect(lastChange('2026-10-05T11:00:01Z', NOW)).toBe('59 minutes ago');
  expect(lastChange('2026-10-05T11:00:00Z', NOW)).toBe('1 hour ago');
  expect(lastChange('2026-10-04T12:00:01Z', NOW)).toBe('23 hours ago');
  expect(lastChange('2026-10-04T12:00:00Z', NOW)).toBe('yesterday');
  expect(lastChange('2026-09-28T12:00:01Z', NOW)).toBe('6 days ago');
  expect(lastChange('2026-09-28T12:00:00Z', NOW)).toBe(
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      Date.parse('2026-09-28T12:00:00Z'),
    ),
  );
});

test('shows each session as a row with its title, folder and last change', () => {
  expect(
    sessionRows(
      [session(), session({ sessionId: 's2', title: null, updatedAt: null })],
      NOW,
    ),
  ).toEqual([
    {
      id: session().sessionId,
      title: 'Fix the login bug',
      folder: '/home/sam/choir',
      time: '3 hours ago',
    },
    {
      id: 's2',
      title: 'Untitled session',
      folder: '/home/sam/choir',
      time: '',
    },
  ]);
});
