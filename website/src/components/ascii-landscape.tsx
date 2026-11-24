'use client';

import { useEffect, useRef } from 'react';
import { useCalmMotion } from './motion-preferences';

const glyphs = '+.:*';
const variation = (index: number) => {
  const value = Math.sin(index * 127.1 + 31.7) * 43758.5453;
  return value - Math.floor(value);
};

const column = 8;
const row = 12;

function artwork(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function skyline(width: number, depth: number) {
  const layer = artwork(width + 96, row * 21);
  const pen = layer.getContext('2d');
  if (!pen) return layer;
  pen.font = '13px monospace';
  pen.textBaseline = 'top';
  const trim = ['#6a5079', '#9a6a89', '#de97a6'][depth];
  const windows = ['#473950', '#62475c', '#886078'][depth];

  for (let x = 0, building = 0; x < layer.width; building++) {
    const seed = building + depth * 37;
    const columns = 4 + Math.floor(variation(seed) * (5 + depth));
    const rows = 4 + Math.floor(variation(seed + 4) * (9 + depth));
    const roof = layer.height - rows * row;
    pen.fillStyle = '#14111d';
    pen.fillRect(x, roof + row, (columns + 2) * column, layer.height - roof);
    pen.fillStyle = trim;
    pen.fillText('.' + '_'.repeat(columns) + '.', x, roof);

    if (variation(seed + 13) > 0.53) {
      pen.fillText('+', x + 2 * column, roof - 2 * row);
      pen.fillText('|', x + 2 * column, roof - row);
    }

    for (let y = roof + row; y < layer.height; y += row) {
      pen.fillStyle = trim;
      pen.fillText('|', x, y);
      pen.fillText('|', x + (columns + 1) * column, y);
      for (let col = 1; col <= columns; col++) {
        const lit = variation(seed * 53 + y * 3 + col);
        pen.fillStyle = lit > 0.89 ? '#eebc9e' : windows;
        if (lit > 0.26) {
          pen.fillText(':.#+'[Math.floor(lit * 4)], x + col * column, y);
        }
      }
    }
    x += (columns + 3 + Math.floor(variation(seed + 6) * 3)) * column;
  }
  return layer;
}

export function AsciiLandscape() {
  const ref = useRef<HTMLCanvasElement>(null);
  const calm = useCalmMotion();

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const pen = canvas?.getContext('2d');
    if (!canvas || !host || !pen) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    let visible = false;
    let targetX = 0;
    let drift = 0;
    let layers: HTMLCanvasElement[] = [];
    const stars = Array.from({ length: 84 }, (_, i) => ({
      x: variation(i + 100),
      y: variation(i + 200),
      phase: variation(i + 300) * Math.PI * 2,
      glyph: glyphs[i % glyphs.length],
    }));

    function paint() {
      if (!pen) return;
      pen.clearRect(0, 0, width, height);
      pen.font = '10px monospace';
      pen.fillStyle = '#f2badf';
      for (const star of stars) {
        pen.globalAlpha = 0.19 + 0.16 * Math.sin(star.phase + elapsed * 0.9);
        pen.fillText(
          star.glyph,
          star.x * width + drift * 6,
          star.y * height * 0.86,
        );
      }
      const flight = ((elapsed + 0.3) % 8) / 1.6;
      if (flight < 1) {
        const x = width * (0.88 - 0.34 * flight);
        const y = height * (0.07 + 0.1 * flight);
        for (let i = 0; i < 11; i++) {
          pen.globalAlpha = Math.sin(Math.PI * flight) * (1 - i / 11) * 0.82;
          pen.fillStyle = i < 3 ? '#ffe5bd' : '#f3a3be';
          pen.fillRect(Math.round(x + i * 4), Math.round(y - i * 2), 3, 2);
        }
      }
      pen.globalAlpha = 1;
      for (const [depth, layer] of layers.entries()) {
        const y = height - layer.height + 15 + depth * 18;
        pen.save();
        pen.globalAlpha = depth === 0 ? 0.72 : 0.91;
        pen.drawImage(layer, -48 + drift * (8 + depth * 15), y);
        pen.restore();
      }
    }

    function tick(time: number) {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      elapsed += dt;
      drift += (targetX - drift) * (1 - Math.exp(-dt * 4.5));
      paint();
      frame = requestAnimationFrame(tick);
    }

    function sync() {
      cancelAnimationFrame(frame);
      if (visible && !document.hidden && !calm) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    const size = new ResizeObserver(() => {
      width = host.clientWidth;
      height = host.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      pen.setTransform(dpr, 0, 0, dpr, 0, 0);
      layers = [0, 1, 2].map((depth) => skyline(width, depth));
      paint();
    });
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const move = (event: PointerEvent) => {
      if (calm || event.pointerType !== 'mouse') return;
      const bounds = host.getBoundingClientRect();
      targetX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    };
    const reset = () => {
      targetX = 0;
    };

    size.observe(host);
    sight.observe(host);
    host.addEventListener('pointermove', move, { passive: true });
    host.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(frame);
      size.disconnect();
      sight.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [calm]);

  return <canvas className="ascii-landscape" ref={ref} aria-hidden="true" />;
}
