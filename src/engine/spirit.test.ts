import { describe, expect, it } from 'vitest';
import { BREAK_MS, FOCUS_MS, SpiritEngine, formatCountdown } from './spirit';

describe('focus clock', () => {
  it('finishes one focus session, starts a break, then returns to idle', () => {
    const engine = new SpiritEngine();
    engine.toggleTimer(0);
    expect(engine.read(0).timer?.remainingMs).toBe(FOCUS_MS);
    expect(engine.read(FOCUS_MS).mood).toBe('TeaBreak');
    expect(engine.read(FOCUS_MS).completedFocusSessions).toBe(1);
    expect(engine.read(FOCUS_MS).timer?.remainingMs).toBe(BREAK_MS);
    expect(engine.read(FOCUS_MS + BREAK_MS).timer).toBeNull();
    expect(engine.read(FOCUS_MS + BREAK_MS).mood).toBe('Idle');
  });

  it('freezes on pause and resumes the remaining duration', () => {
    const engine = new SpiritEngine();
    engine.toggleTimer(0);
    engine.toggleTimer(60_000);
    expect(engine.read(600_000).timer).toMatchObject({
      status: 'paused',
      remainingMs: FOCUS_MS - 60_000,
    });
    engine.toggleTimer(600_000);
    expect(engine.read(610_000).timer?.remainingMs).toBe(FOCUS_MS - 70_000);
  });

  it('does not award a cancelled focus session', () => {
    const engine = new SpiritEngine();
    engine.toggleTimer(0);
    engine.resetTimer(60_000);
    expect(engine.read(FOCUS_MS * 3)).toMatchObject({
      timer: null,
      completedFocusSessions: 0,
    });
  });

  it('reconciles a long sleep without drift or awarding repeated sessions', () => {
    const engine = new SpiritEngine();
    engine.toggleTimer(0);
    expect(engine.read(FOCUS_MS + 45_000).timer?.remainingMs).toBe(
      BREAK_MS - 45_000,
    );
    expect(engine.read(4 * FOCUS_MS)).toMatchObject({
      timer: null,
      completedFocusSessions: 1,
    });
    expect(engine.read(5 * FOCUS_MS).completedFocusSessions).toBe(1);
  });

  it('does not add time when the system clock moves backward', () => {
    const engine = new SpiritEngine();
    engine.toggleTimer(0);
    const before = engine.read(60_000).timer?.remainingMs;
    expect(engine.read(30_000).timer?.remainingMs).toBe(before);
  });

  it('keeps focus active through petting, night time, and prolonged idle', () => {
    const engine = new SpiritEngine();
    engine.toggleTimer(0);
    engine.observeActivity({ idleSeconds: 700, sampledAtMs: 1000 }, 1000);
    expect(engine.interact(1000)).toBe(false);
    expect(engine.read(1000, 23 * 60 + 45)).toMatchObject({
      mood: 'Working',
      timer: { status: 'running', remainingMs: FOCUS_MS - 1000 },
    });
  });
});

describe('activity and mood priorities', () => {
  it('requires sustained recent input for more than 15 seconds', () => {
    const engine = new SpiritEngine();
    for (const now of [0, 5000, 10_000, 15_000]) {
      engine.observeActivity({ idleSeconds: 0, sampledAtMs: now }, now);
      expect(engine.read(now).mood).toBe('Idle');
    }
    engine.observeActivity({ idleSeconds: 0, sampledAtMs: 20_000 }, 20_000);
    expect(engine.read(20_000).mood).toBe('Working');
    engine.observeActivity({ idleSeconds: 6, sampledAtMs: 25_000 }, 25_000);
    expect(engine.read(25_000).mood).toBe('Idle');
  });

  it('sleeps after five minutes away, then rests briefly on return after ten minutes', () => {
    const engine = new SpiritEngine();
    engine.observeActivity({ idleSeconds: 300, sampledAtMs: 0 }, 0);
    expect(engine.read(0).mood).toBe('Sleeping');
    engine.observeActivity({ idleSeconds: 601, sampledAtMs: 5000 }, 5000);
    engine.observeActivity({ idleSeconds: 0, sampledAtMs: 10_000 }, 10_000);
    expect(engine.read(10_000).mood).toBe('TeaBreak');
    expect(engine.read(40_000).mood).toBe('Idle');
  });

  it('clears a temporary happy reaction and uses the current underlying mood', () => {
    const engine = new SpiritEngine();
    expect(engine.interact(0)).toBe(true);
    expect(engine.read(1999).mood).toBe('Happy');
    expect(engine.read(2000, 23 * 60 + 30).mood).toBe('Sleeping');
    expect(engine.read(2001, 6 * 60).mood).toBe('Idle');
  });

  it('never treats unavailable, stale, or out-of-order samples as fresh activity', () => {
    const engine = new SpiritEngine();
    engine.observeActivity({ idleSeconds: 0, sampledAtMs: 20_000 }, 20_000);
    engine.observeActivity({ idleSeconds: 700, sampledAtMs: 19_000 }, 20_000);
    expect(engine.read(20_000).mood).toBe('Idle');
    expect(engine.read(40_000).activityAvailable).toBe(false);
    engine.observeActivity({ idleSeconds: 0, sampledAtMs: 20_000 }, 40_000);
    expect(engine.read(40_000).activityAvailable).toBe(false);
    engine.observeActivity({ idleSeconds: null, sampledAtMs: 40_000 }, 40_000);
    expect(engine.read(40_000).mood).toBe('Idle');
  });

  it('lets a break be paused, resumed, and reset without another completion', () => {
    const engine = new SpiritEngine();
    engine.toggleTimer(0);
    engine.toggleTimer(FOCUS_MS + 1000);
    expect(engine.read(FOCUS_MS + 100_000).timer).toMatchObject({
      phase: 'Break',
      status: 'paused',
      remainingMs: BREAK_MS - 1000,
    });
    engine.toggleTimer(FOCUS_MS + 100_000);
    engine.resetTimer(FOCUS_MS + 101_000);
    expect(engine.read(FOCUS_MS + 102_000).completedFocusSessions).toBe(1);
  });
});

it('formats countdowns without showing zero seconds prematurely', () => {
  expect(formatCountdown(FOCUS_MS)).toBe('25:00');
  expect(formatCountdown(1)).toBe('00:01');
  expect(formatCountdown(-1)).toBe('00:00');
});
