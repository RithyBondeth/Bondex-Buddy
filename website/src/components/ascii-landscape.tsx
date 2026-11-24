'use client';

import { useEffect, useRef } from 'react';
import { useCalmMotion } from './motion-preferences';

// Draw the landscape on a character grid. Each ridge moves at a different depth.
export function AsciiLandscape() {
  const ref = useRef<HTMLCanvasElement>(null);
  const calm = useCalmMotion();
  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const pen = canvas?.getContext('2d');
    if (!canvas || !host || !pen) return;
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      elapsed = 0,
      visible = false;
    let pointer = 0.5,
      drift = 0.5;
    const trail: { x: number; y: number; born: number }[] = [];
    const ridgeColors = ['#66557d', '#ad755f', '#e8a881'];
    function paint() {
      if (!pen) return;
      pen.clearRect(0, 0, width, height);
      pen.font = '10px monospace';
      const cols = Math.ceil(width / 8);
      for (let col = 0; col < cols; col++) {
        const x = col * 8;
        for (let layer = 0; layer < 3; layer++) {
          const z = col / cols + (drift - 0.5) * 0.045 * (layer + 1);
          const crest =
            Math.sin(z * 9 + layer * 1.8 + elapsed * 0.07) * 0.44 +
            Math.sin(z * 18 - layer + elapsed * 0.04) * 0.22 +
            Math.sin(z * 37 + layer) * 0.09;
          const top =
            height - (2.9 - layer + crest) * Math.min(38, height * 0.06);
          const row = Math.floor(top / 11);
          for (let j = 0; j < 5; j++) {
            const n = (col * 7 + row * 3 + j * 5 + layer) % 11;
            pen.fillStyle = ridgeColors[layer];
            pen.globalAlpha = (1 - j * 0.15) * (0.45 + layer * 0.17);
            pen.fillText(
              (j === 0 ? '_-/~^' : '.:+#=')[Math.abs(n) % 5],
              x,
              (row + j) * 11,
            );
          }
        }
        if (col % 5 === 0) {
          const y = (col * 149 + 51) % Math.max(1, height - 110);
          pen.globalAlpha = 0.32 + 0.18 * Math.sin(elapsed + col);
          pen.fillStyle = '#d8b8eb';
          pen.fillText(col % 3 === 0 ? '+' : '.', x, y);
        }
      }
      const now = performance.now();
      while (trail.length && now - trail[0].born > 730) trail.shift();
      for (const point of trail) {
        const age = (now - point.born) / 730;
        pen.globalAlpha = (1 - age) * 0.7;
        pen.fillStyle = age < 0.32 ? '#ffbb90' : '#dbc4ff';
        pen.fillText(
          '#+:. '[Math.min(4, Math.floor(age * 5))],
          point.x,
          point.y - 8 * age,
        );
      }
      pen.globalAlpha = 1;
    }
    function tick(time: number) {
      frame = 0;
      if (!visible || document.hidden || calm) return;
      if (time - last >= 65) {
        elapsed += Math.min((time - last) / 1000, 0.1);
        last = time;
        drift += (pointer - drift) * 0.16;
        paint();
      }
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
      paint();
    });
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const move = (event: PointerEvent) => {
      if (calm || event.pointerType === 'touch') return;
      const rect = host.getBoundingClientRect();
      const x = Math.round((event.clientX - rect.left) / 8) * 8;
      const y = Math.round((event.clientY - rect.top) / 11) * 11;
      pointer = x / Math.max(1, width);
      const prev = trail.at(-1);
      if (prev?.x !== x || prev.y !== y) {
        if (trail.length >= 36) trail.shift();
        trail.push({ x, y, born: performance.now() });
      }
    };
    size.observe(host);
    sight.observe(host);
    host.addEventListener('pointermove', move);
    document.addEventListener('visibilitychange', sync);
    return () => {
      cancelAnimationFrame(frame);
      size.disconnect();
      sight.disconnect();
      host.removeEventListener('pointermove', move);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [calm]);
  return <canvas className="ascii-landscape" ref={ref} aria-hidden="true" />;
}
