'use client';

import { useEffect, useRef } from 'react';
import { petPose, type PetKind, type PetMood } from '@/lib/pet-animation';
import { abilityPose, abilityTime, placeBody } from '../../../shared/abilities';
import { createHeroRig } from '../../../shared/hero-rig';
import { drawAbility } from '../../../shared/ability-effects';
import { createPetRenderer, PET_RESOLUTION } from '@/lib/pet-renderer';
import {
  heroPose,
  type HeroAction,
  type HeroId,
} from '../../../shared/hero-motion';

const heroMoods: Record<PetMood, HeroAction> = {
  idle: 'idle',
  working: 'working',
  break: 'break',
  sleeping: 'rest',
};

/** One small, capped Canvas loop. No React state changes on animation frames. */
export function usePetCanvas({
  kind,
  image,
  hero,
  mood,
  calm,
}: {
  kind: PetKind;
  image: string;
  hero?: HeroId;
  mood: PetMood;
  calm: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawOnce = useRef<(() => void) | null>(null);
  const hitTest = useRef<((x: number, y: number) => boolean) | null>(null);
  const behavior = useRef({
    curious: false,
    look: 0,
    reactionAt: -Infinity,
    dragging: false,
    movingUntil: -Infinity,
  });
  useEffect(() => {
    const host = root.current;
    const paper = canvas.current;
    const output = paper?.getContext('2d');
    if (!host || !paper || !output) return;
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = PET_RESOLUTION;
    const pen = sprite.getContext('2d');
    if (!pen) return;
    const id = kind === 'hero' ? hero : kind;
    if (!id) return;
    const scale = PET_RESOLUTION / 36;
    const pad = (paper.width - PET_RESOLUTION) / 2;
    const feet = (id === 'moss' ? 35 : hero ? 32 : 34) * scale;
    let inverse: DOMMatrix | undefined;
    let disposed = false;
    let visible = false;
    let frame = 0;
    let lastDraw = -Infinity;
    let performing = false;
    let elapsed = 0;
    let lastTime: number | null = null;
    let rig: ReturnType<typeof createHeroRig> | undefined;
    let paint: ReturnType<typeof createPetRenderer> = null;
    const source = new window.Image();
    const now = () => performance.now();

    const draw = (time: number) => {
      if (!paint || disposed) return;
      const state = behavior.current;
      const reactionAge = time - state.reactionAt;
      const walking = state.dragging || time < state.movingUntil;
      const t = abilityTime(
        elapsed,
        mood === 'sleeping' ? Infinity : reactionAge,
        mood === 'idle' && !walking,
        calm,
      );
      performing = t !== null;
      const acting = t === null ? undefined : abilityPose(id, t);
      if (!rig || t === null)
        paint(
          pen,
          petPose({
            kind,
            mood,
            elapsed,
            reactionAge,
            curious: state.curious,
            look: state.look,
            reduced: Boolean(calm),
          }),
          hero
            ? heroPose(
                hero,
                walking ? 'walk' : heroMoods[mood],
                elapsed,
                calm,
                state.look,
              )
            : undefined,
        );
      output.clearRect(0, 0, paper.width, paper.height);
      output.save();
      output.translate(pad, pad);
      output.imageSmoothingEnabled = false;
      if (acting && t !== null)
        drawAbility(
          output,
          id,
          t,
          acting,
          PET_RESOLUTION / 2,
          feet,
          scale,
          1,
          false,
        );
      output.save();
      if (acting) placeBody(output, acting, PET_RESOLUTION / 2, feet, scale, 1);
      inverse = acting ? output.getTransform().inverse() : undefined;
      if (rig && t !== null) rig(output, t, 0, 0, PET_RESOLUTION);
      else output.drawImage(sprite, 0, 0);
      output.restore();
      if (acting && t !== null)
        drawAbility(
          output,
          id,
          t,
          acting,
          PET_RESOLUTION / 2,
          feet,
          scale,
          1,
          true,
        );
      output.restore();
    };
    const active = () => !disposed && visible && !document.hidden && !calm;
    const tick = (time: number) => {
      frame = 0;
      if (!active() || !paint) return;
      if (lastTime !== null) elapsed += Math.max(0, time - lastTime);
      lastTime = time;
      const interval = 1000 / (hero || performing ? 60 : 30);
      if (time - lastDraw >= interval) {
        draw(time);
        lastDraw = Number.isFinite(lastDraw)
          ? time - ((time - lastDraw) % interval)
          : time;
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
      if (hero) rig = createHeroRig(hero, source);
      paint = createPetRenderer(source, kind, mood);
      if (!paint) return;
      const contains = paint.contains;
      hitTest.current = (x, y) => {
        if (!inverse) return contains(x, y);
        const point = inverse.transformPoint({
          x: pad + x * PET_RESOLUTION,
          y: pad + y * PET_RESOLUTION,
        });
        return contains(point.x / PET_RESOLUTION, point.y / PET_RESOLUTION);
      };
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
  }, [kind, image, hero, mood, calm]);
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
    setDragging: (dragging: boolean) => {
      behavior.current.dragging = dragging;
    },
    step: () => {
      behavior.current.movingUntil = performance.now() + 250;
    },
    startReaction: () => {
      behavior.current.reactionAt = performance.now();
    },
  };
}
