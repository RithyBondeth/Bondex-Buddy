const MINUTE = 60_000;
export const WATER_INTERVALS = [0, 30, 60, 90] as const;
export type WaterInterval = (typeof WATER_INTERVALS)[number];
export type WaterAction = 'drank' | 'snooze' | 'skip';

export function isWaterInterval(value: unknown): value is WaterInterval {
  return WATER_INTERVALS.some((minutes) => minutes === value);
}

export class WaterSchedule {
  private interval: WaterInterval = 0;
  private nextAt = Infinity;

  configure(interval: WaterInterval, now: number) {
    this.interval = interval;
    this.respond('skip', now);
  }

  due(now: number) {
    return now >= this.nextAt;
  }

  respond(action: WaterAction, now: number) {
    this.nextAt = this.interval
      ? now + (action === 'snooze' ? 10 : this.interval) * MINUTE
      : Infinity;
  }
}
