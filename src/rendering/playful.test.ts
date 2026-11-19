import { describe, expect, it } from 'vitest';
import {
  playPose,
  restingPlay,
  samplePlayDemo,
  POUNCE_MS,
  PLAY_DEMO_MS,
  type PlayAction,
} from './playful';

const active = (action: PlayAction, elapsedMs: number) => ({
  ...restingPlay(),
  roaming: true,
  action,
  elapsedMs,
});
describe('authored pet actions', () => {
  it('uses distinct walking and galloping sheets, with eight frames in both directions', () => {
    for (const action of ['walk', 'run'] as const)
      for (const facing of [-1, 1] as const) {
        const frames = new Set<number>();
        for (let time = 0; time < 1760; time += 20) {
          const pose = playPose({ ...active(action, time), facing });
          frames.add(pose.frame);
          expect(pose.sheet).toBe(action);
          expect(pose.facing).toBe(facing);
          expect(pose.lift).toBe(0);
        }
        expect(frames.size).toBe(8);
      }
  });
  it('plays a bow, crouch, takeoff, tucked flight, landing and recovery exactly once', () => {
    const beats = [
      [0, 0],
      [320, 1],
      [460, 2],
      [550, 3],
      [730, 4],
      [840, 5],
      [960, 6],
      [1160, 7],
      [POUNCE_MS, 7],
      [60000, 7],
    ];
    for (const [time, frame] of beats) {
      const pose = playPose(active('pounce', time));
      expect(pose.sheet).toBe('play');
      expect(pose.frame).toBe(frame);
    }
    expect(POUNCE_MS).toBe(1500);
  });
  it('keeps the bow grounded, takes off after crouching and lands softly', () => {
    const lift = (time: number) => playPose(active('pounce', time)).lift;
    for (const time of [0, 320, 460, 800, 1500, 60000])
      expect(lift(time)).toBe(0);
    expect(lift(630)).toBe(11);
    for (let time = 0; time < 1500; time += 33)
      expect(Math.abs(lift(time + 33) - lift(time))).toBeLessThanOrEqual(4);
  });
  it('ducks into a crouch and holds a different curious pose when peeking', () => {
    const hide = playPose(active('hide', 1000)),
      peek = playPose(active('peek', 1000));
    expect(hide.sheet).toBe('play');
    expect(hide.frame).toBe(1);
    expect(peek.sheet).toBe('play');
    expect(peek.frame).toBe(7);
  });
  it('synchronizes paws to eased desktop distance, including braking to a stop', () => {
    for (const [action, cycle, step] of [
      ['walk', 880, 110],
      ['run', 560, 70],
    ] as const) {
      const play = { ...active(action, 10000), gaitMs: 0 };
      expect(playPose(play).frame).toBe(0);
      expect(playPose({ ...play, gaitMs: step * 3 }).frame).toBe(3);
      expect(playPose({ ...play, gaitMs: cycle }).frame).toBe(0);
    }
  });
  it('removes all action poses and movement for reduced motion or a parked pet', () => {
    for (const action of [
      'rest',
      'walk',
      'run',
      'pounce',
      'hide',
      'peek',
    ] as PlayAction[]) {
      expect(playPose(active(action, 630), true)).toEqual(playPose());
      expect(playPose({ ...active(action, 630), roaming: false })).toEqual(
        playPose(),
      );
    }
  });
  it('sanitizes invalid times and gait values', () => {
    for (const elapsedMs of [-10, NaN, Infinity, -Infinity])
      expect(playPose(active('run', elapsedMs))).toEqual(
        playPose(active('run', 0)),
      );
    expect(playPose({ ...active('run', 140), gaitMs: NaN }).frame).toBe(2);
  });
});

describe('complete play preview', () => {
  it('approaches the Dock, hides completely, holds a peek, then reemerges', () => {
    expect(samplePlayDemo(5700, 100).play.action).toBe('hide');
    expect(samplePlayDemo(6900, 100).y).toBe(120);
    expect(samplePlayDemo(7600, 100).y).toBe(48);
    expect(samplePlayDemo(8500, 100).y).toBe(48);
    expect(samplePlayDemo(10500, 100).y).toBe(0);
    expect(samplePlayDemo(11000, 100).play.action).toBe('run');
    expect(samplePlayDemo(11000, 100).play.facing).toBe(-1);
  });
  it('joins every phase and the loop without teleporting or going out of bounds', () => {
    for (const time of [
      0,
      2200,
      3700,
      5700,
      6350,
      7050,
      7600,
      8650,
      9150,
      9650,
      10500,
      12500,
      PLAY_DEMO_MS,
    ]) {
      const before = samplePlayDemo(
          (time - 0.1 + PLAY_DEMO_MS) % PLAY_DEMO_MS,
          110,
        ),
        after = samplePlayDemo(time + 0.1, 110);
      expect(Math.abs(before.x - after.x)).toBeLessThan(0.1);
      expect(Math.abs(before.y - after.y)).toBeLessThan(0.1);
    }
    for (let time = 0; time < PLAY_DEMO_MS * 2; time += 33) {
      const pose = samplePlayDemo(time, 110);
      expect(Math.abs(pose.x)).toBeLessThanOrEqual(110);
      expect(pose.y).toBeGreaterThanOrEqual(0);
      expect(pose.y).toBeLessThanOrEqual(120);
    }
  });
});
