import { expect, test } from 'vitest';
import { dateTime, fromLocalInput, localInput } from './inbox-time';

test('shows a date with its time in the time zone of the browser', () => {
  const time = new Date(2026, 8, 28, 9, 5);
  expect(dateTime(time.toISOString())).toBe(
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(time),
  );
});

test('edits a due date in local time and saves it as an instant', () => {
  const time = new Date(2026, 0, 2, 3, 4);
  expect(localInput(time.toISOString())).toBe('2026-01-02T03:04');
  expect(localInput(new Date(2026, 10, 12, 13, 14).toISOString())).toBe(
    '2026-11-12T13:14',
  );
  expect(localInput(null)).toBe('');
  expect(fromLocalInput('2026-01-02T03:04')).toBe(time.toISOString());
  expect(fromLocalInput('')).toBeNull();
});
