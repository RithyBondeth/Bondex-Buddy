import { describe, expect, it } from 'vitest';
import {
  MOTION,
  anchorOffset,
  clipDuration,
  poseAt,
  spriteBands,
  type Pose,
} from './motion';
import type { Mood } from '../engine/spirit';

const moods = Object.keys(MOTION) as Mood[];
describe('pixel motion timelines', () => {
  it('advances exactly at keyframe boundaries and repeats calm loops without drift', () => {
    for (const mood of moods.filter((m) => m !== 'Happy')) {
      let time = 0;
      for (const beat of MOTION[mood]) {
        expect(poseAt(mood, time)).toBe(beat.pose);
        expect(poseAt(mood, time + beat.durationMs - 1)).toBe(beat.pose);
        expect(poseAt(mood, time + clipDuration(mood) * 1000)).toBe(beat.pose);
        time += beat.durationMs;
      }
      expect(poseAt(mood, time)).toBe(MOTION[mood][0]!.pose);
    }
  });
  it('settles Happy after one greeting instead of repeating the hop forever', () => {
    expect(poseAt('Happy', 100)).toBe('hop-high');
    expect(clipDuration('Happy')).toBe(2000);
    for (const time of [660, 1999, 2000, 60_000])
      expect(poseAt('Happy', time)).toBe('rest');
  });
  it('uses a neutral pose for reduced motion at every phase', () => {
    for (const mood of moods)
      for (const time of [0, 100, 2200, 1_000_000])
        expect(poseAt(mood, time, true)).toBe('rest');
  });
  it('sanitizes invalid and backward elapsed times', () => {
    for (const mood of moods)
      for (const time of [-200, NaN, Infinity, -Infinity])
        expect(poseAt(mood, time)).toBe(poseAt(mood, 0));
  });
});

describe('pixel deformation geometry', () => {
  const poses: Pose[] = ['rest', 'inhale', 'nod', 'sip', 'hop-low', 'hop-high'];
  it('covers every source/destination row without gaps and preserves grounded feet', () => {
    for (const height of [8, 32, 37, 48])
      for (const pose of poses) {
        const bands = spriteBands(height, pose);
        let sourceEnd = 0;
        let destinationEnd = bands[0]!.destinationY;
        for (const b of bands) {
          expect(b.sourceY).toBe(sourceEnd);
          expect(b.destinationY).toBe(destinationEnd);
          expect(b.sourceHeight).toBeGreaterThan(0);
          expect(b.destinationHeight).toBeGreaterThan(0);
          expect(Object.values(b).every(Number.isInteger)).toBe(true);
          sourceEnd += b.sourceHeight;
          destinationEnd += b.destinationHeight;
        }
        expect(sourceEnd).toBe(height);
        expect(destinationEnd).toBe(
          height - (pose === 'hop-high' ? 2 : pose === 'hop-low' ? 1 : 0),
        );
      }
  });
  it('keeps the hat attached to the head and scarf moving with a hop', () => {
    expect(anchorOffset(48, 0, 'inhale')).toBe(-1);
    expect(anchorOffset(48, 0, 'nod')).toBe(1);
    expect(anchorOffset(48, 30, 'hop-high')).toBe(-2);
    expect(() => spriteBands(0, 'rest')).toThrow();
  });
});
