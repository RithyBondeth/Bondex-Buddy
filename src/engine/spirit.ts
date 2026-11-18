export type Mood = 'Idle' | 'Working' | 'Sleeping' | 'TeaBreak' | 'Happy';
export type TimerPhase = 'Focus' | 'Break';

export const FOCUS_MS = 25 * 60_000;
export const BREAK_MS = 5 * 60_000;
const ACTIVE_SECONDS = 5;
const STALE_ACTIVITY_MS = 15_000;

export interface ActivityReading {
  idleSeconds: number | null;
  sampledAtMs: number;
}

interface Session {
  phase: TimerPhase;
  running: boolean;
  deadline: number;
  remainingMs: number;
}

export interface SpiritSnapshot {
  mood: Mood;
  timer: {
    phase: TimerPhase;
    status: 'running' | 'paused';
    remainingMs: number;
  } | null;
  completedFocusSessions: number;
  activityAvailable: boolean;
}

/** Deterministic state machine. All clock and activity inputs are injected. */
export class SpiritEngine {
  private now: number;
  private session: Session | null = null;
  private completed = 0;
  private idleSeconds: number | null = null;
  private sampledAt = -Infinity;
  private activeSince: number | null = null;
  private wasAway = false;
  private returningUntil = 0;
  private happyUntil = 0;

  constructor(nowMs = 0) {
    this.now = nowMs;
  }

  private advance(nowMs: number): void {
    // A backward wall-clock adjustment must not increase remaining time.
    if (Number.isFinite(nowMs)) this.now = Math.max(this.now, nowMs);
    if (this.now - this.sampledAt > STALE_ACTIVITY_MS) {
      this.idleSeconds = null;
      this.activeSince = null;
    }
    if (!this.session?.running || this.now < this.session.deadline) return;
    if (this.session.phase === 'Focus') {
      this.completed++;
      const deadline = this.session.deadline + BREAK_MS;
      this.session =
        this.now < deadline
          ? { phase: 'Break', running: true, deadline, remainingMs: BREAK_MS }
          : null;
    } else {
      this.session = null;
    }
    // Finishing a break returns to a calm idle state, not an endless auto-cycle.
    if (!this.session) this.activeSince = null;
  }

  observeActivity(reading: ActivityReading, nowMs: number): void {
    this.advance(nowMs);
    if (
      !Number.isFinite(reading.sampledAtMs) ||
      reading.sampledAtMs < this.sampledAt ||
      this.now - reading.sampledAtMs > STALE_ACTIVITY_MS ||
      reading.sampledAtMs > this.now + 1000
    )
      return;
    this.sampledAt = reading.sampledAtMs;
    const idle = reading.idleSeconds;
    if (idle === null || !Number.isFinite(idle) || idle < 0) {
      this.idleSeconds = null;
      this.activeSince = null;
      return;
    }
    this.idleSeconds = idle;
    if (idle > 600) this.wasAway = true;
    if (idle < ACTIVE_SECONDS) {
      if (this.wasAway) {
        this.returningUntil = this.now + 30_000;
        this.wasAway = false;
      }
      this.activeSince ??= this.now;
    } else {
      this.activeSince = null;
    }
  }

  toggleTimer(nowMs: number): void {
    this.advance(nowMs);
    if (!this.session) {
      this.session = {
        phase: 'Focus',
        running: true,
        deadline: this.now + FOCUS_MS,
        remainingMs: FOCUS_MS,
      };
    } else if (this.session.running) {
      this.session.remainingMs = Math.max(0, this.session.deadline - this.now);
      this.session.running = false;
    } else {
      this.session.deadline = this.now + this.session.remainingMs;
      this.session.running = true;
    }
  }

  resetTimer(nowMs: number): void {
    this.advance(nowMs);
    this.session = null;
    this.activeSince = null;
    this.returningUntil = 0;
    this.happyUntil = 0;
  }

  interact(nowMs: number): boolean {
    this.advance(nowMs);
    // Interaction cannot displace Working during a running focus session.
    if (this.session?.phase === 'Focus' && this.session.running) return false;
    this.happyUntil = this.now + 2000;
    return true;
  }

  read(nowMs: number, localMinutes = 12 * 60): SpiritSnapshot {
    this.advance(nowMs);
    const night = localMinutes >= 23 * 60 + 30 || localMinutes < 6 * 60;
    let mood: Mood = 'Idle';
    if (this.session?.running && this.session.phase === 'Focus')
      mood = 'Working';
    else if (this.happyUntil > this.now) mood = 'Happy';
    else if (this.session?.phase === 'Break') mood = 'TeaBreak';
    else if (night || (this.idleSeconds !== null && this.idleSeconds >= 300))
      mood = 'Sleeping';
    else if (this.returningUntil > this.now) mood = 'TeaBreak';
    else if (this.activeSince !== null && this.now - this.activeSince > 15_000)
      mood = 'Working';

    return {
      mood,
      timer: this.session
        ? {
            phase: this.session.phase,
            status: this.session.running ? 'running' : 'paused',
            remainingMs: this.session.running
              ? Math.max(0, this.session.deadline - this.now)
              : this.session.remainingMs,
          }
        : null,
      completedFocusSessions: this.completed,
      activityAvailable: this.idleSeconds !== null,
    };
  }
}

export function formatCountdown(remainingMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
