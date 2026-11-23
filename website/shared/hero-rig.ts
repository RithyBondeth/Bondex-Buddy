import { phase, type AbilityPose } from './abilities';
import type { HeroId } from './hero-motion';

type Side = 'left' | 'right';
type Rect = [number, number, number, number];
const joints = { left: [11, 21], right: [25, 21] } as const;
const rad = Math.PI / 180;
const sweep = (t: number, start: number, peak: number, release: number) =>
  Math.sin((phase(t, start, peak) * Math.PI) / 2) *
  Math.cos((phase(t, peak, release) * Math.PI) / 2);

export function armAngles(id: HeroId, t: number): Record<Side, number> {
  switch (id) {
    case 'spider-man':
      return {
        left: 52 * sweep(t, 0.18, 0.48, 0.86),
        right: -157 * sweep(t, 0.02, 0.23, 0.76),
      };
    case 'iron-man':
      return {
        left: 28 * sweep(t, 0.07, 0.32, 0.88),
        right: -105 * sweep(t, 0.17, 0.38, 0.84),
      };
    case 'thor':
      return {
        left: 148 * sweep(t, 0.02, 0.4, 0.58) - 34 * sweep(t, 0.51, 0.6, 0.87),
        right: -30 * sweep(t, 0.16, 0.4, 0.66),
      };
    case 'hulk':
      return {
        left: 142 * sweep(t, 0.17, 0.43, 0.57),
        right: -137 * sweep(t, 0.16, 0.43, 0.56),
      };
    case 'captain-america':
      return {
        left: 96 * sweep(t, 0.03, 0.33, 0.63) + 34 * sweep(t, 0.68, 0.83, 1),
        right: -47 * sweep(t, 0.12, 0.32, 0.73),
      };
    case 'black-widow':
      return {
        left: 108 * sweep(t, 0.39, 0.62, 0.88),
        right: -106 * sweep(t, 0.09, 0.32, 0.56),
      };
    case 'hawkeye':
      return {
        left: -53 * sweep(t, 0.02, 0.4, 0.71),
        right: -16 * sweep(t, 0.06, 0.42, 0.76),
      };
  }
}

// Both the sprite and the particle emitter rotate around the same shoulder.
export function handPosition(
  id: HeroId,
  t: number,
  body: AbilityPose,
  side: Side,
  localX: number,
  localY: number,
): [number, number] {
  const a = armAngles(id, t)[side] * rad,
    [px, py] = joints[side];
  const dx = localX - px,
    dy = localY - py;
  const x =
    (px + dx * Math.cos(a) - dy * Math.sin(a) - 18) / Math.sqrt(body.stretch);
  const y = (py + dx * Math.sin(a) + dy * Math.cos(a) - 32) * body.stretch;
  const b = body.tilt * rad;
  return [
    body.x + x * Math.cos(b) - y * Math.sin(b),
    -body.lift + x * Math.sin(b) + y * Math.cos(b),
  ];
}

/** Cut the original pixels once. A held prop travels with the hand that owns it. */
export function createHeroRig(id: HeroId, image: HTMLImageElement) {
  function sheet() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 36;
    const pen = canvas.getContext('2d')!;
    pen.imageSmoothingEnabled = false;
    return { canvas, pen };
  }
  const core = sheet();
  core.pen.drawImage(image, 0, 0, 36, 36);
  let left: Rect[] = [[8, 20, 4, 8]],
    right: Rect[] = [[24, 20, 4, 8]];
  if (id === 'thor') left = [[2, 17, 10, 13]];
  if (id === 'hulk') {
    left = [
      [6, 19, 7, 7],
      [6, 26, 4, 3],
    ];
    right = [
      [23, 19, 7, 7],
      [26, 26, 4, 3],
    ];
  }
  if (id === 'hawkeye')
    right = [
      [24, 20, 3, 8],
      [27, 14, 5, 15],
    ];
  if (id === 'captain-america') left = [[5, 20, 10, 12]];
  const cut = (rects: Rect[]) => {
    const part = sheet();
    for (const rect of rects) {
      part.pen.drawImage(core.canvas, ...rect, ...rect);
      core.pen.clearRect(...rect);
    }
    return part.canvas;
  };
  const arms = { left: cut(left), right: cut(right) };
  if (id === 'captain-america') {
    // The original shield overlaps the left boot. Mirror the exposed right boot underneath it.
    core.pen.save();
    core.pen.translate(36, 0);
    core.pen.scale(-1, 1);
    core.pen.drawImage(core.canvas, 21, 20, 3, 12, 21, 20, 3, 12);
    core.pen.restore();
  }
  return (
    c: CanvasRenderingContext2D,
    t: number,
    x: number,
    y: number,
    size: number,
    facing = 1,
  ) => {
    c.save();
    c.translate(x + (facing < 0 ? size : 0), y);
    c.scale((size / 36) * facing, size / 36);
    c.imageSmoothingEnabled = false;
    c.drawImage(core.canvas, 0, 0);
    const angles = armAngles(id, t);
    for (const side of ['left', 'right'] as const) {
      const [px, py] = joints[side];
      c.save();
      c.translate(px, py);
      c.rotate(angles[side] * rad);
      c.translate(-px, -py);
      if (id === 'captain-america' && side === 'left' && t > 0.22 && t < 0.83) {
        c.translate(36, 0);
        c.scale(-1, 1);
        c.drawImage(arms.right, 0, 0);
      } else c.drawImage(arms[side], 0, 0);
      c.restore();
    }
    c.restore();
  };
}
