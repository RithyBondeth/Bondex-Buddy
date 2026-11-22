import { expect, it } from 'vitest';
import { decodeProgress, freshProgress } from './progress';
import { WaterSchedule } from './water';

it('keeps water reminders off by default and persists the selected interval', () => {
  expect(freshProgress().waterMinutes).toBe(0);
  expect(
    decodeProgress(JSON.stringify({ ...freshProgress(), waterMinutes: 60 }))
      .waterMinutes,
  ).toBe(60);
  expect(
    decodeProgress(JSON.stringify({ ...freshProgress(), waterMinutes: 1 }))
      .waterMinutes,
  ).toBe(0);
});

it('starts a new interval after a response and keeps a snooze short', () => {
  const minute = 60_000;
  const schedule = new WaterSchedule();
  expect(schedule.due(90 * minute)).toBe(false);
  schedule.configure(30, 0);
  expect(schedule.due(29 * minute)).toBe(false);
  expect(schedule.due(30 * minute)).toBe(true);
  schedule.respond('snooze', 31 * minute);
  expect(schedule.due(40 * minute)).toBe(false);
  expect(schedule.due(41 * minute)).toBe(true);
  schedule.respond('drank', 41 * minute);
  expect(schedule.due(70 * minute)).toBe(false);
  expect(schedule.due(71 * minute)).toBe(true);
  schedule.configure(0, 72 * minute);
  expect(schedule.due(999 * minute)).toBe(false);
});
