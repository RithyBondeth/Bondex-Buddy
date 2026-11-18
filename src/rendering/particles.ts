import type { Mood } from '../engine/spirit';

const HEART = ['0110110', '1111111', '0111110', '0011100', '0001000'];
const SLEEP = ['1111', '0001', '0010', '0100', '1111'];

function stamp(
  context: CanvasRenderingContext2D,
  rows: string[],
  x: number,
  y: number,
): void {
  rows.forEach((row, dy) =>
    [...row].forEach((pixel, dx) => {
      if (pixel === '1') context.fillRect(x + dx, y + dy, 1, 1);
    }),
  );
}

/** Decorative pixels never enter the native click mask. All positions are integers. */
export function drawParticles(
  context: CanvasRenderingContext2D,
  mood: Mood,
  elapsedMs: number,
): void {
  if (mood !== 'TeaBreak' && mood !== 'Sleeping' && mood !== 'Happy') return;
  const count = mood === 'Happy' ? 3 : 2;
  const lifetime = mood === 'Happy' ? 2000 : 2600;
  context.save();
  for (let i = 0; i < count; i++) {
    const age = elapsedMs - i * 650;
    if (age < 0 || (mood === 'Happy' && age >= lifetime)) continue;
    const progress = (age % lifetime) / lifetime;
    const rise = Math.floor(progress * 15);
    context.globalAlpha = (1 - progress) * 0.8;
    if (mood === 'TeaBreak') {
      context.fillStyle = '#b9b8aa';
      const x = 54 + i * 3 + (Math.floor(progress * 4) % 2);
      context.fillRect(x, 75 - rise, 1, 3);
      context.fillRect(x + 1, 74 - rise, 1, 2);
    } else if (mood === 'Sleeping') {
      context.fillStyle = '#8896a8';
      stamp(context, SLEEP, 77 + i * 6, 63 - rise);
    } else {
      context.fillStyle = '#c46e72';
      stamp(context, HEART, i === 1 ? 26 : 76 + i * 3, 53 - rise);
    }
  }
  context.restore();
}
