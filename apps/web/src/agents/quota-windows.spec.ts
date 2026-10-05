import { expect, test } from 'vitest';
import { quotaWindows, resetTime } from './quota-windows';

const NOW = Date.parse('2026-10-05T12:00:00Z');

const TIME = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

const DAY_AND_TIME = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

function seconds(iso: string): number {
  return Date.parse(iso) / 1000;
}

test('tells the reset time, with the day once it is a day away or more', () => {
  const soon = seconds('2026-10-06T11:59:59Z');
  const later = seconds('2026-10-06T12:00:00Z');
  expect(resetTime(soon, NOW)).toBe(TIME.format(soon * 1000));
  expect(resetTime(later, NOW)).toBe(DAY_AND_TIME.format(later * 1000));
});

test('shows the five hour and weekly windows in that order', () => {
  const fiveHour = seconds('2026-10-05T15:00:00Z');
  const week = seconds('2026-10-09T08:00:00Z');
  expect(
    quotaWindows(
      [
        {
          window: 'seven_day',
          utilization: 0.125,
          resetsAt: week,
          status: 'allowed',
        },
        {
          window: 'seven_day_opus',
          utilization: 0.9,
          resetsAt: week,
          status: 'allowed',
        },
        {
          window: 'five_hour',
          utilization: 0.444,
          resetsAt: fiveHour,
          status: 'allowed',
        },
      ],
      NOW,
    ),
  ).toEqual([
    { label: '5-hour', percent: 44, resets: resetTime(fiveHour, NOW) },
    { label: 'Weekly', percent: 13, resets: resetTime(week, NOW) },
  ]);
  expect(quotaWindows([], NOW)).toEqual([]);
});
