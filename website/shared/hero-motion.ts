export const heroNames = {
  'spider-man': 'Spider-Man',
  'iron-man': 'Iron Man',
  thor: 'Thor',
  hulk: 'Hulk',
  'captain-america': 'Captain America',
  'black-widow': 'Black Widow',
  hawkeye: 'Hawkeye',
} as const;

export type HeroId = keyof typeof heroNames;
export type HeroAction =
  'idle' | 'working' | 'rest' | 'break' | 'greet' | 'walk' | 'run' | 'crouch';

const profiles = {
  'spider-man': { breath: 3100, hop: 5, tilt: 2, height: 1 },
  'iron-man': { breath: 4100, hop: 6, tilt: 0, height: 1 },
  thor: { breath: 3700, hop: 4, tilt: -1, height: 1 },
  hulk: { breath: 4700, hop: 3, tilt: 0, height: 2 },
  'captain-america': { breath: 3900, hop: 3, tilt: 1, height: 1 },
  'black-widow': { breath: 3400, hop: 2, tilt: -2, height: 1 },
  hawkeye: { breath: 4300, hop: 2, tilt: 2, height: 1 },
} satisfies Record<
  HeroId,
  { breath: number; hop: number; tilt: number; height: number }
>;

export function isHero(value: unknown): value is HeroId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(heroNames, value)
  );
}

export const HERO_GRID = 36;
export const HERO_BASELINE = 32;

export function heroPose(
  id: HeroId,
  action: HeroAction,
  elapsed: number,
  reduced = false,
  attention = 0,
) {
  const profile = profiles[id];
  const time = Number.isFinite(elapsed) ? Math.max(elapsed, 0) : 0;
  const breath = (period: number) =>
    (1 - Math.cos(((time % period) / period) * Math.PI * 2)) / 2;
  const pose = {
    lift: 0,
    headX: 0,
    headY: action === 'rest' ? 3 : action === 'crouch' ? 4 : 0,
    step: 0,
  };
  if (reduced) return pose;
  if (action === 'walk' || action === 'run') {
    const period = action === 'run' ? 560 : 880;
    const wave = Math.sin(((time % period) / period) * Math.PI * 2);
    pose.step = Math.round(wave * (action === 'run' ? 2 : 1));
    pose.lift = action === 'run' ? Math.round(Math.abs(wave) * 2) : 0;
    pose.headY = pose.step ? -1 : 0;
  } else if (action === 'greet') {
    if (time >= 1000) return pose;
    const phase = time / 1000;
    if (phase < 0.2) {
      pose.headY = Math.round(Math.sin((phase / 0.2) * Math.PI) * 2);
    } else {
      const arc = Math.sin(((phase - 0.2) / 0.8) * Math.PI);
      pose.lift = Math.round(arc * profile.hop);
      pose.headX = Math.round(arc * profile.tilt);
    }
  } else if (action === 'working') {
    pose.headY = 1 + Math.round(breath(profile.breath) * profile.height);
  } else if (action === 'rest' || action === 'break') {
    pose.headY -= Math.round(breath(profile.breath + 900));
  } else if (action === 'idle') {
    pose.headY = -Math.round(breath(profile.breath) * profile.height);
    pose.headX = Math.round(Math.max(-1, Math.min(1, attention)));
  }
  return pose;
}

export type HeroPose = ReturnType<typeof heroPose>;

/** Draw the source head, torso and feet on the sprite's original pixel grid. */
export function drawHero(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  pose: HeroPose,
  x: number,
  y: number,
  size: number,
  facing = 1,
) {
  const source = image.naturalWidth / HERO_GRID;
  const draw = (
    left: number,
    top: number,
    width: number,
    height: number,
    dx: number,
    dy: number,
    destinationHeight = height,
  ) =>
    context.drawImage(
      image,
      left * source,
      top * source,
      width * source,
      height * source,
      dx,
      dy,
      width,
      destinationHeight,
    );
  context.save();
  context.imageSmoothingEnabled = false;
  context.translate(x, y);
  context.scale(size / HERO_GRID, size / HERO_GRID);
  if (facing < 0) {
    context.translate(HERO_GRID, 0);
    context.scale(-1, 1);
  }
  context.translate(0, -pose.lift);
  const head = 17;
  const feet = 29;
  draw(0, 0, HERO_GRID, head, pose.headX, pose.headY);
  draw(
    0,
    head,
    HERO_GRID,
    feet - head,
    0,
    head + pose.headY,
    feet - head - pose.headY,
  );
  draw(0, feet, 18, HERO_GRID - feet, pose.step, feet - Math.max(0, pose.step));
  draw(
    18,
    feet,
    18,
    HERO_GRID - feet,
    18 - pose.step,
    feet + Math.min(0, pose.step),
  );
  context.restore();
}
