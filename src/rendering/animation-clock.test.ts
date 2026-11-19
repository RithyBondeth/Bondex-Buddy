import { describe, expect, it, vi } from 'vitest';
import { AnimationClock } from './animation-clock';

function setup() {
  let next = 0;
  let time = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const draw = vi.fn();
  const clock = new AnimationClock(draw, {
    request(callback) {
      pending.set(++next, callback);
      return next;
    },
    cancel(handle) {
      pending.delete(handle);
    },
    now: () => time,
  });
  const step = (now: number) => {
    time = now;
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(time));
  };
  return { clock, draw, pending, step };
}

describe('animation lifecycle', () => {
  it('caps drawing on a high-refresh display and never starts duplicate loops', () => {
    const { clock, draw, pending, step } = setup();
    clock.setState(true, false);
    clock.setState(true, false);
    expect(pending.size).toBe(1);
    for (let time = 8; time <= 1000; time += 8) step(time);
    expect(draw.mock.calls.length).toBeGreaterThan(20);
    expect(draw.mock.calls.length).toBeLessThanOrEqual(31);
    expect(pending.size).toBe(1);
  });

  it('holds a steady thirty-frame cadence across common display refresh rates', () => {
    for (const refresh of [60, 120, 144]) {
      const { clock, draw, step } = setup();
      clock.setState(true, false);
      for (let frame = 1; frame <= refresh; frame++)
        step((frame * 1000) / refresh);
      expect(draw.mock.calls.length).toBeGreaterThanOrEqual(30);
      expect(draw.mock.calls.length).toBeLessThanOrEqual(31);
      clock.dispose();
    }
  });

  it('cancels frames while hidden and resumes without a catch-up burst', () => {
    const { clock, draw, pending, step } = setup();
    clock.setState(true, false);
    clock.setState(false, false);
    expect(pending.size).toBe(0);
    step(60_000);
    expect(draw).toHaveBeenCalledTimes(1);
    clock.setState(true, false);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(pending.size).toBe(1);
  });

  it('renders one static frame for reduced motion and cancels scheduled animation', () => {
    const { clock, draw, pending } = setup();
    clock.setState(true, false);
    clock.setState(true, true);
    expect(draw).toHaveBeenLastCalledWith(0, true);
    expect(pending.size).toBe(0);
    clock.setState(true, false);
    expect(pending.size).toBe(1);
  });

  it('cannot be restarted after disposal', () => {
    const { clock, draw, pending, step } = setup();
    clock.setState(true, false);
    clock.dispose();
    clock.setState(true, false);
    step(1000);
    expect(pending.size).toBe(0);
    expect(draw).toHaveBeenCalledTimes(1);
  });
});
