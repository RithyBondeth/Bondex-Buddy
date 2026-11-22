'use client';

import { useEffect, useRef } from 'react';
import { petPose, type PetKind, type PetMood } from '@/lib/pet-animation';
import { createPetRenderer } from '@/lib/pet-renderer';

/** One small, capped Canvas loop. No React state changes on animation frames. */
export function usePetCanvas({
  kind,
  image,
  mood,
  calm,
}: {
  kind: PetKind;
  image: string;
  mood: PetMood;
  calm: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawOnce = useRef<(() => void) | null>(null);
  const hitTest = useRef<((x: number, y: number) => boolean) | null>(null);
  const behavior = useRef({ curious: false, look: 0, reactionAt: -Infinity });
  useEffect(() => {
    const host = root.current;
    const paper = canvas.current;
    const output = paper?.getContext('2d');
    if (!host || !paper || !output) return;
    let disposed = false;
    let visible = false;
    let frame = 0;
    let lastDraw = -Infinity;
    let elapsed = 0;
    let lastTime: number | null = null;
    let paint: ReturnType<typeof createPetRenderer> = null;
    const source = new window.Image();
    const now = () => performance.now();

    const draw = (time: number) => {
      if (!paint || disposed) return;
      const state = behavior.current;
      paint(
        output,
        petPose({
          kind,
          mood,
          elapsed,
          reactionAge: time - state.reactionAt,
          curious: state.curious,
          look: state.look,
          reduced: Boolean(calm),
        }),
      );
    };
    const active = () => !disposed && visible && !document.hidden && !calm;
    const tick = (time: number) => {
      frame = 0;
      if (!active() || !paint) return;
      if (lastTime !== null) elapsed += Math.max(0, time - lastTime);
      lastTime = time;
      if (time - lastDraw >= 1000 / 24) {
        draw(time);
        lastDraw = time;
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      lastTime = null;
      if (active() && paint && !frame) frame = requestAnimationFrame(tick);
    };
    const suspend = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    };
    const onVisibility = () => {
      if (document.hidden) suspend();
      else resume();
    };
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) resume();
      else suspend();
    });
    sight.observe(host);
    document.addEventListener('visibilitychange', onVisibility);
    drawOnce.current = () => draw(now());
    source.onload = () => {
      if (disposed) return;
      paint = createPetRenderer(source, kind, mood);
      if (!paint) return;
      hitTest.current = paint.contains;
      draw(now());
      host.dataset.petReady = 'true';
      resume();
    };
    // The original image remains visible if loading or Canvas setup fails.
    source.src = image;
    return () => {
      disposed = true;
      suspend();
      sight.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      source.onload = null;
      drawOnce.current = null;
      hitTest.current = null;
      delete host.dataset.petReady;
    };
  }, [kind, image, mood, calm]);
  return {
    root,
    canvas,
    drawOnce,
    contains: (x: number, y: number) => hitTest.current?.(x, y) ?? false,
    getBehavior: () => behavior.current,
    setCuriosity: (curious: boolean) => {
      behavior.current.curious = curious;
      if (!curious) behavior.current.look = 0;
    },
    lookAt: (look: number) => {
      behavior.current.look = look;
    },
    startReaction: () => {
      behavior.current.reactionAt = performance.now();
    },
    endReaction: () => {
      behavior.current.reactionAt = -Infinity;
    },
  };
}
