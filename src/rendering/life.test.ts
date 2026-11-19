import { describe, expect, it } from 'vitest';
import { lifeAt } from './life';
import type { Mood } from '../engine/spirit';

const moods: Mood[] = ['Idle', 'Working', 'Sleeping', 'TeaBreak', 'Happy'];

describe('secondary pet gestures', () => {
  it('keeps gestures bounded, deterministic, and in integer pixels over long sessions', () => {
    for (const mood of moods)
      for (let time = 0; time < 120000; time += 43) {
        const frame = lifeAt(mood, time);
        expect(frame).toEqual(lifeAt(mood, time));
        expect(
          [frame.ear, frame.tail, frame.look].every(Number.isInteger),
        ).toBe(true);
        expect(Math.abs(frame.ear)).toBeLessThanOrEqual(1);
        expect(Math.abs(frame.tail)).toBeLessThanOrEqual(2);
        expect(Math.abs(frame.look)).toBeLessThanOrEqual(1);
      }
  });
  it('has brief varied blinks and independent ear and tail movement', () => {
    const frames = Array.from({ length: 2400 }, (_, i) =>
      lifeAt('Idle', i * 10),
    );
    const closed = frames.filter((frame) => frame.blink).length;
    expect(closed).toBeGreaterThan(30);
    expect(closed).toBeLessThan(100);
    expect(frames.some((frame) => frame.ear !== 0 && !frame.blink)).toBe(true);
    expect(frames.some((frame) => frame.tail !== 0 && frame.ear === 0)).toBe(
      true,
    );
    expect(frames.some((frame) => frame.look !== 0)).toBe(true);
    expect(frames.slice(0, 1200)).not.toEqual(frames.slice(1200));
  });
  it('rests during sleep, tea, reduced motion, and after the greeting finishes', () => {
    const neutral = { blink: false, ear: 0, tail: 0, look: 0 };
    for (let time = 0; time < 15000; time += 100) {
      for (const mood of moods)
        expect(lifeAt(mood, time, true)).toEqual(neutral);
      expect(lifeAt('Sleeping', time)).toEqual(neutral);
      expect(lifeAt('TeaBreak', time)).toEqual(neutral);
      if (time >= 2000) expect(lifeAt('Happy', time)).toEqual(neutral);
    }
  });
  it('treats invalid or negative elapsed times as the first frame', () => {
    for (const mood of moods)
      for (const time of [-20, NaN, Infinity, -Infinity])
        expect(lifeAt(mood, time)).toEqual(lifeAt(mood, 0));
  });
});
