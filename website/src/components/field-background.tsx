'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { fieldSize, makeAsciiRibbon, paintAsciiWake } from './ascii-pointer';
import { useCalmMotion } from './motion-preferences';

const radius = fieldSize / 2;
const wakeDuration = 560;
const spacing = 24;

type WakeLayer = {
  canvas: HTMLCanvasElement;
  pen: CanvasRenderingContext2D;
};

type Wake = {
  x: number;
  y: number;
  start: number;
  layers: WakeLayer[];
};

export function FieldBackground({ children }: { children: ReactNode }) {
  const page = useRef<HTMLDivElement>(null);
  const calm = useCalmMotion();

  useEffect(() => {
    const root = page.current;
    if (!root) return;
    const tiles = new Map<string, string>();
    const surfaces = root.querySelectorAll<HTMLElement>(
      '.site-header, main > section, .field-footer',
    );
    for (const surface of surfaces) {
      const style = getComputedStyle(surface);
      const ink = style.getPropertyValue('--field-ascii-base');
      const accent = style.getPropertyValue('--field-ascii-edge');
      const key = ink + accent;
      let tile = tiles.get(key);
      if (!tile) {
        tile = makeAsciiRibbon(ink, accent);
        tiles.set(key, tile);
      }
      surface.style.setProperty('--field-ascii-texture', tile);
      const top = surface.getBoundingClientRect().top + window.scrollY;
      surface.style.setProperty('--field-ascii-offset', `${-top}px`);
    }

    const align = () => {
      for (const surface of surfaces) {
        const top = surface.getBoundingClientRect().top + window.scrollY;
        surface.style.setProperty('--field-ascii-offset', `${-top}px`);
      }
    };
    const resize = new ResizeObserver(align);
    resize.observe(root);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    const root = page.current;
    const hover = window.matchMedia(
      '(any-hover: hover) and (any-pointer: fine)',
    );
    if (!root || calm || !hover.matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const surfaces = Array.from(
      root.querySelectorAll<HTMLElement>(
        '.site-header, main > section, .field-footer',
      ),
    );
    const wakes: Wake[] = [];
    let latest: Pick<Wake, 'x' | 'y' | 'start'> | null = null;
    let frame = 0;
    let lastDraw = -Infinity;

    const paint = (now: number) => {
      frame = 0;
      const redraw = now - lastDraw >= 30;
      if (redraw) lastDraw = now;
      for (let i = wakes.length - 1; i >= 0; i--) {
        const wake = wakes[i];
        const progress = Math.max(0, (now - wake.start) / wakeDuration);
        if (progress >= 1) {
          for (const { canvas } of wake.layers) canvas.remove();
          wakes.splice(i, 1);
          continue;
        }
        if (!redraw) continue;
        for (const { pen } of wake.layers) {
          paintAsciiWake(pen, wake.x, wake.y, progress);
        }
      }
      if (wakes.length) frame = requestAnimationFrame(paint);
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !hover.matches || document.hidden)
        return;
      // Stamp motion onto the page grid so the wake stays where it started.
      const x =
        Math.round((event.clientX + window.scrollX) / spacing) * spacing;
      const y =
        Math.round((event.clientY + window.scrollY) / spacing) * spacing;
      const start = performance.now();
      if (
        latest &&
        ((latest.x === x && latest.y === y) || start - latest.start < 68)
      )
        return;
      latest = { x, y, start };

      const layers = surfaces.flatMap((surface) => {
        const rect = surface.getBoundingClientRect();
        const left = x - window.scrollX - rect.left;
        const top = y - window.scrollY - rect.top;
        if (
          left < -radius ||
          left > rect.width + radius ||
          top < -radius ||
          top > rect.height + radius
        )
          return [];

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.round(fieldSize * dpr);
        canvas.className = 'field-hover-art';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.width = canvas.style.height = `${fieldSize}px`;
        canvas.style.left = `${left - radius}px`;
        canvas.style.top = `${top - radius}px`;
        const pen = canvas.getContext('2d');
        if (!pen) return [];

        pen.scale(dpr, dpr);
        const style = getComputedStyle(surface);
        const tint = pen.createLinearGradient(0, 0, fieldSize, fieldSize);
        tint.addColorStop(0, style.getPropertyValue('--field-ascii-edge'));
        tint.addColorStop(0.52, style.getPropertyValue('--field-ascii-ink'));
        tint.addColorStop(1, style.getPropertyValue('--field-ascii-tail'));
        pen.fillStyle = tint;
        surface.prepend(canvas);
        return [{ canvas, pen }];
      });
      if (!layers.length) return;
      wakes.push({ x, y, start, layers });
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      latest = null;
      for (const wake of wakes) {
        for (const { canvas } of wake.layers) canvas.remove();
      }
      wakes.length = 0;
    };

    root.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', clear);
    window.addEventListener('resize', clear);
    document.addEventListener('visibilitychange', clear);
    hover.addEventListener('change', clear);
    return () => {
      clear();
      root.removeEventListener('pointermove', move);
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', clear);
      document.removeEventListener('visibilitychange', clear);
      hover.removeEventListener('change', clear);
    };
  }, [calm]);

  return (
    <div ref={page} className="field-site">
      {children}
    </div>
  );
}
