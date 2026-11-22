'use client';

import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from 'react';
import { useCalmMotion } from '@/components/motion-preferences';
import { cn } from '@/lib/utils';

type Point = { x: number; y: number };
type Pulse = { col: number; row: number; start: number };

type GridPulseProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  cell?: number;
  /** Radius of the pointer light, in cells. */
  reach?: number;
  /** Number of quiet background pulses per cycle. */
  ambient?: number;
};

const pulseDuration = 2200;
const lightness = [56, 62, 53, 59] as const;
const gridHue = (row: number, rows: number) =>
  Math.round((420 - (270 * row) / Math.max(rows - 1, 1)) % 360);

const approach = (
  current: number,
  target: number,
  elapsed: number,
  time: number,
) => target + (current - target) * Math.exp(-elapsed / time);

const falloff = (distance: number) => {
  const t = Math.max(0, 1 - distance);
  return t * t * (3 - 2 * t);
};

/** A decorative grid with one continuous light field beneath the pointer. */
export function GridPulse({
  cell = 32,
  reach = 3.4,
  ambient = 2,
  className,
  style,
  ...props
}: GridPulseProps) {
  const reduced = useCalmMotion();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const layer = box.current;
    const surface = canvas.current;
    const section = layer?.parentElement;
    const context = surface?.getContext('2d');
    if (!layer || !surface || !section || !context) return;
    const [el, paper, parent, ctx] = [
      layer,
      surface,
      section,
      context,
    ] as const;
    if (reduced) {
      ctx.clearRect(0, 0, paper.width, paper.height);
      return;
    }

    let width = 0;
    let height = 0;
    let rowHues: number[] = [];
    let bounds = el.getBoundingClientRect();
    let text: DOMRect[] = [];
    let layoutDirty = true;
    let visible = false;
    let frame = 0;
    let timer = 0;
    let last = 0;
    let strength = 0;
    let pointer: Point | null = null;
    let center: Point | null = null;
    let pulses: Pulse[] = [];

    function wake() {
      if (!frame && visible && !document.hidden)
        frame = requestAnimationFrame(draw);
    }

    function measureLayout() {
      bounds = el.getBoundingClientRect();
      text = [...parent.querySelectorAll('[data-grid-avoid]')].flatMap(
        (node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()];
        },
      );
      layoutDirty = false;
    }

    function invalidateLayout() {
      layoutDirty = true;
      if (pointer || strength || pulses.length) wake();
    }

    function measureSize() {
      width = el.clientWidth;
      height = el.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      paper.width = Math.round(width * dpr);
      paper.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rowHues = Array.from({ length: Math.ceil(height / cell) }, (_, row) =>
        gridHue(row, Math.ceil(height / cell)),
      );
      invalidateLayout();
    }

    function paintCell(col: number, row: number, alpha: number) {
      const x = col * cell + cell / 2 + bounds.left;
      const y = row * cell + cell / 2 + bounds.top;
      let nearest = Infinity;
      for (const rect of text) {
        const dx = Math.max(rect.left - x - 6, 0, x - rect.right - 6);
        const dy = Math.max(rect.top - y - 6, 0, y - rect.bottom - 6);
        nearest = Math.min(nearest, dx * dx + dy * dy);
        if (nearest === 0) break;
      }
      const textDim = 1 - 0.85 * falloff(Math.sqrt(nearest) / (cell * 1.6));
      ctx.globalAlpha = alpha * textDim;
      // Keep the tint tied to the cell so it stays steady as the light moves.
      const tint = lightness[(col * 7 + row * 13) % lightness.length];
      ctx.fillStyle = `hsl(${rowHues[row]} 94% ${tint}%)`;
      ctx.fillRect(col * cell + 1, row * cell + 1, cell - 1, cell - 1);
    }

    function draw(now: number) {
      frame = 0;
      if (layoutDirty) measureLayout();
      const elapsed = last ? Math.min(now - last, 50) : 16;
      last = now;
      const target = pointer && {
        x: pointer.x - bounds.left,
        y: pointer.y - bounds.top,
      };
      const inside =
        target &&
        target.x >= 0 &&
        target.x < width &&
        target.y >= 0 &&
        target.y < height;

      if (inside) {
        center = center
          ? {
              x: approach(center.x, target.x, elapsed, 65),
              y: approach(center.y, target.y, elapsed, 65),
            }
          : target;
      }
      strength = approach(
        strength,
        inside ? 1 : 0,
        elapsed,
        inside ? 105 : 150,
      );
      if (!inside && strength < 0.005) {
        strength = 0;
        center = null;
      }

      ctx.clearRect(0, 0, width, height);
      pulses = pulses.filter((pulse) => now - pulse.start < pulseDuration);
      for (const pulse of pulses) {
        const phase = Math.max(0, (now - pulse.start) / pulseDuration);
        paintCell(pulse.col, pulse.row, 0.12 * Math.sin(Math.PI * phase) ** 2);
      }

      if (center) {
        const radius = reach * cell;
        const xMin = Math.max(0, Math.floor((center.x - radius) / cell));
        const xMax = Math.min(
          Math.ceil(width / cell),
          Math.ceil((center.x + radius) / cell),
        );
        const yMin = Math.max(0, Math.floor((center.y - radius) / cell));
        const yMax = Math.min(
          Math.ceil(height / cell),
          Math.ceil((center.y + radius) / cell),
        );
        for (let row = yMin; row < yMax; row++) {
          for (let col = xMin; col < xMax; col++) {
            const distance = Math.hypot(
              (col + 0.5) * cell - center.x,
              (row + 0.5) * cell - center.y,
            );
            const alpha = 0.64 * strength * falloff(distance / radius);
            if (alpha > 0.001) paintCell(col, row, alpha);
          }
        }
      }
      ctx.globalAlpha = 1;

      const moving =
        inside &&
        center &&
        (strength < 0.995 ||
          Math.hypot(center.x - target.x, center.y - target.y) > 0.1);
      if (moving || (!inside && strength > 0) || pulses.length) wake();
      else last = 0;
    }

    function onMove(event: PointerEvent) {
      if (document.hidden || event.pointerType === 'touch') return;
      if (!pointer) layoutDirty = true;
      pointer = { x: event.clientX, y: event.clientY };
      wake();
    }

    function leave() {
      pointer = null;
      if (strength) wake();
    }

    function pulse() {
      if (!visible || document.hidden || ambient <= 0) return;
      const start = performance.now();
      const cols = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);
      pulses = Array.from({ length: ambient }, () => ({
        col: Math.floor(Math.random() * cols),
        row: Math.floor(Math.random() * rows),
        start,
      }));
      wake();
      timer = window.setTimeout(pulse, 2800);
    }

    function syncVisibility() {
      window.clearTimeout(timer);
      if (visible && !document.hidden) {
        invalidateLayout();
        if (ambient > 0) timer = window.setTimeout(pulse, 700);
        return;
      }
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      strength = 0;
      center = pointer = null;
      pulses = [];
      ctx.clearRect(0, 0, width, height);
    }

    const sight = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      syncVisibility();
    });
    sight.observe(el);
    const resize = new ResizeObserver(measureSize);
    resize.observe(el);
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', invalidateLayout);
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('scroll', invalidateLayout, { passive: true });
    window.addEventListener('blur', leave);
    parent.addEventListener('pointermove', onMove, { passive: true });
    parent.addEventListener('pointerleave', leave);
    parent.addEventListener('pointercancel', leave);
    measureSize();

    return () => {
      sight.disconnect();
      resize.disconnect();
      fonts?.removeEventListener('loadingdone', invalidateLayout);
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('scroll', invalidateLayout);
      window.removeEventListener('blur', leave);
      parent.removeEventListener('pointermove', onMove);
      parent.removeEventListener('pointerleave', leave);
      parent.removeEventListener('pointercancel', leave);
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [cell, reach, ambient, reduced]);

  return (
    <div
      ref={box}
      aria-hidden
      data-slot="grid-pulse"
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        '[--grid-pulse-line:color-mix(in_oklab,var(--color-foreground)_5%,transparent)]',
        '[mask-image:linear-gradient(to_bottom,#000_89%,transparent)]',
        className,
      )}
      style={
        {
          backgroundImage:
            'linear-gradient(to right, var(--grid-pulse-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-pulse-line) 1px, transparent 1px)',
          backgroundSize: `${cell}px ${cell}px`,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}
