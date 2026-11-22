'use client';

import { useEffect, useRef } from 'react';
import { useCalmMotion } from '@/components/motion-preferences';
import './habitat-ambience.css';

type Habitat = 'garden' | 'moonlight' | 'forest';
const W = 320;
const H = 240;

function butterfly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  phase: number,
  color: string,
) {
  const wing = 1 + Math.round(Math.abs(Math.sin(time * 12 + phase)) * 3);
  ctx.fillStyle = '#795a48';
  ctx.fillRect(x, y - 1, 1, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x - wing, y - 2, wing, 4);
  ctx.fillRect(x + 1, y - 2, wing, 4);
  ctx.fillRect(x - Math.max(1, wing - 1), y + 2, Math.max(1, wing - 1), 2);
  ctx.fillRect(x + 1, y + 2, Math.max(1, wing - 1), 2);
}

function paint(ctx: CanvasRenderingContext2D, habitat: Habitat, t: number) {
  ctx.clearRect(0, 0, W, H);
  if (habitat === 'garden') {
    const paths = [
      [0.19, 0.49, 0.08, 0.09],
      [0.81, 0.45, 0.07, 0.12],
      [0.29, 0.73, 0.05, 0.04],
    ];
    paths.forEach(([x, y, dx, dy], i) =>
      butterfly(
        ctx,
        Math.round((x + Math.sin(t * 0.5 + i * 2) * dx) * W),
        Math.round((y + Math.sin(t * 0.73 + i * 3) * dy) * H),
        t,
        i * 2,
        ['#eab96b', '#d3b5d5', '#f0d393'][i],
      ),
    );
  } else if (habitat === 'moonlight') {
    [
      [0.14, 0.37],
      [0.29, 0.24],
      [0.7, 0.26],
      [0.88, 0.18],
      [0.9, 0.43],
      [0.24, 0.14],
    ].forEach(([x, y], i) => {
      ctx.globalAlpha =
        0.25 + (Math.sin(t * (0.9 + i * 0.07) + i * 1.9) + 1) * 0.36;
      ctx.fillStyle = '#be9c52';
      ctx.fillRect(Math.round(x * W), Math.round(y * H) - 2, 1, 5);
      ctx.fillRect(Math.round(x * W) - 2, Math.round(y * H), 5, 1);
      ctx.fillStyle = '#fff8ce';
      ctx.fillRect(Math.round(x * W), Math.round(y * H), 1, 1);
    });
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 0.79 : 0.2;
      const x = Math.round((side + Math.sin(t * 0.34 + i * 2.7) * 0.09) * W);
      const y = Math.round(
        (0.48 + (i % 3) * 0.08 + Math.cos(t * 0.47 + i) * 0.1) * H,
      );
      const glow = 0.3 + (1 + Math.sin(t * 1.25 + i * 1.6)) * 0.3;
      ctx.globalAlpha = glow * 0.14;
      ctx.fillStyle = '#e2bf70';
      ctx.fillRect(x - 3, y - 3, 7, 7);
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#e8c97f';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = '#fff7ca';
      ctx.fillRect(x, y, 1, 1);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const progress = (((t / (12 + i * 1.5) + i * 0.19) % 1) + 1) % 1;
      const side = i % 2 ? 0.83 : 0.17;
      const x = (side + Math.sin(progress * Math.PI * 3 + i) * 0.075) * W;
      const y = (0.19 + progress * 0.61) * H;
      ctx.globalAlpha = Math.min(1, progress * 7, (1 - progress) * 7) * 0.85;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(Math.sin(progress * Math.PI * 4 + i) * 0.7 + i);
      ctx.fillStyle = ['#84975b', '#a2a967', '#c1a568'][i % 3];
      ctx.fillRect(-2, -1, 5, 3);
      ctx.fillRect(-1, -2, 3, 5);
      ctx.fillStyle = '#657d4c';
      ctx.fillRect(-1, 0, 4, 1);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

export function HabitatAmbience({
  habitat,
  active,
}: {
  habitat: Habitat;
  active: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  const calm = useCalmMotion();
  useEffect(() => {
    const paper = canvas.current;
    const ctx = paper?.getContext('2d');
    if (!paper || !ctx) return;
    let frame = 0;
    let last: number | null = null;
    let drawn = -Infinity;
    let visible = false;
    ctx.imageSmoothingEnabled = false;
    paint(ctx, habitat, elapsed.current / 1000);
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = null;
    };
    const tick = (time: number) => {
      frame = 0;
      if (!visible || document.hidden || calm || !active) return;
      if (last !== null) elapsed.current += time - last;
      last = time;
      if (time - drawn >= 1000 / 24) {
        paint(ctx, habitat, elapsed.current / 1000);
        drawn = time;
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (visible && !document.hidden && !calm && active && !frame)
        frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden) stop();
      else resume();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) resume();
      else stop();
    });
    observer.observe(paper);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [habitat, calm, active]);
  return (
    <canvas
      ref={canvas}
      className="habitat-ambience"
      data-ambience={habitat}
      width={W}
      height={H}
      aria-hidden="true"
    />
  );
}
