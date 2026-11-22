const frameInterval = 1000 / 60;

interface FrameDriver {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
  now(): number;
}

/** One capped render loop. Hidden and reduced-motion habitats have no RAF loop. */
export class AnimationClock {
  private handle: number | null = null;
  private visible = false;
  private reduced = false;
  private disposed = false;
  private lastFrame = -Infinity;

  constructor(
    private readonly draw: (time: number, reduced: boolean) => void,
    private readonly driver: FrameDriver = {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
      now: () => performance.now(),
    },
  ) {}

  setState(visible: boolean, reduced: boolean): void {
    if (this.disposed || (this.visible === visible && this.reduced === reduced))
      return;
    this.visible = visible;
    this.reduced = reduced;
    if (this.handle !== null) this.driver.cancel(this.handle);
    this.handle = null;
    if (!visible) return;
    this.lastFrame = this.driver.now();
    this.draw(this.lastFrame, reduced);
    if (!reduced) this.handle = this.driver.request(this.frame);
  }

  private readonly frame = (time: number): void => {
    this.handle = null;
    if (this.disposed || !this.visible || this.reduced) return;
    const elapsed = time - this.lastFrame;
    const steps = Math.floor((elapsed + 0.001) / frameInterval);
    if (steps > 0) {
      // Preserve the cadence across refresh rates and timestamp rounding.
      this.lastFrame += frameInterval * steps;
      this.draw(time, false);
    }
    this.handle = this.driver.request(this.frame);
  };

  dispose(): void {
    this.disposed = true;
    if (this.handle !== null) this.driver.cancel(this.handle);
    this.handle = null;
  }
}
