'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { useCalmMotion } from '@/components/motion-preferences';
import { REACTION_MS, type PetKind, type PetMood } from '@/lib/pet-animation';
import { PET_RESOLUTION } from '@/lib/pet-renderer';
import { cn } from '@/lib/utils';
import { usePetCanvas } from './use-pet-canvas';

const greetings: Record<PetKind, string> = {
  ember: 'Oh, hello! A little head pat?',
  moon: 'A sleepy hello, just for you.',
  moss: 'You made a little friend.',
};
const reactions: Record<PetKind, string> = {
  ember: 'Ember loves a little head pat.',
  moon: 'A slow blink. Cat for “I like you.”',
  moss: 'A tiny hop. A very happy bunny.',
};

export function LivingPet({
  kind,
  name,
  image,
  mood = 'idle',
  className,
  eager = false,
  onMessage,
  moveBy,
}: {
  kind: PetKind;
  name: string;
  image: string;
  mood?: PetMood;
  className?: string;
  eager?: boolean;
  onMessage?: (message: string) => void;
  moveBy?: (distance: number) => void;
}) {
  const calm = Boolean(useCalmMotion());
  const {
    root,
    canvas,
    drawOnce,
    getBehavior,
    setCuriosity,
    contains,
    startReaction,
    endReaction,
  } = usePetCanvas({
    kind,
    image,
    mood,
    calm,
  });
  const hovered = useRef(false);
  const focused = useRef(false);
  const greeting = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [curious, setCurious] = useState(false);
  const [reaction, setReaction] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const press = useRef<{ id: number; x: number } | null>(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();

  useEffect(
    () => () => {
      if (dismiss.current) clearTimeout(dismiss.current);
      if (greeting.current) clearTimeout(greeting.current);
    },
    [],
  );

  const notify = () => {
    const active = performance.now() - getBehavior().reactionAt < REACTION_MS;
    onMessage?.(
      active
        ? mood === 'sleeping'
          ? 'Shh. Cozy dreams.'
          : reactions[kind]
        : getBehavior().curious
          ? greetings[kind]
          : '',
    );
  };
  const engage = () => {
    const engaged = hovered.current || focused.current;
    setCuriosity(engaged);
    setCurious(engaged);
    if (greeting.current) clearTimeout(greeting.current);
    if (engaged && !focused.current) greeting.current = setTimeout(notify, 200);
    else notify();
    drawOnce.current?.();
  };
  const isOnPet = (event: {
    currentTarget: HTMLButtonElement;
    clientX: number;
    clientY: number;
  }) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const size = Math.min(bounds.width, bounds.height);
    return contains(
      (event.clientX - bounds.left - (bounds.width - size) / 2) / size,
      (event.clientY - bounds.top - (bounds.height - size) / 2) / size,
    );
  };
  const trackPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const held = press.current;
    if (moveBy && held?.id === event.pointerId) {
      const distance = event.clientX - held.x;
      if (moved.current || Math.abs(distance) >= 4) {
        if (!moved.current) {
          moved.current = true;
          setDragging(true);
          hovered.current = false;
          engage();
        }
        held.x = event.clientX;
        moveBy(distance);
        return;
      }
    }
    if (event.pointerType === 'touch') return;
    const inside = isOnPet(event);
    if (inside !== hovered.current) {
      hovered.current = inside;
      engage();
    }
  };
  const pet = () => {
    startReaction();
    setReaction((count) => count + 1);
    setCelebrating(true);
    notify();
    drawOnce.current?.();
    if (dismiss.current) clearTimeout(dismiss.current);
    dismiss.current = setTimeout(() => {
      setCelebrating(false);
      endReaction();
      notify();
      dismiss.current = null;
    }, REACTION_MS);
  };
  const feedback = celebrating
    ? mood === 'sleeping'
      ? 'Shh. Cozy dreams.'
      : reactions[kind]
    : curious
      ? greetings[kind]
      : '';

  return (
    <div
      ref={root}
      className={cn('living-pet', className)}
      data-pet={kind}
      data-engaged={curious}
      data-draggable={Boolean(moveBy)}
      data-dragging={dragging}
      data-calm={Boolean(calm)}
      data-interaction={celebrating ? 'happy' : curious ? 'curious' : 'idle'}
    >
      <button
        type="button"
        className="living-pet-button"
        aria-label={`Pet ${name}`}
        aria-describedby={hintId}
        onClick={(event) => {
          if (event.detail === 0 || (!moved.current && isOnPet(event))) pet();
        }}
        onPointerDown={(event) => {
          moved.current = false;
          if (!moveBy || event.button !== 0 || !isOnPet(event)) return;
          press.current = { id: event.pointerId, x: event.clientX };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => {
          press.current = null;
          setDragging(false);
        }}
        onKeyDown={(event) => {
          if (!moveBy || !['ArrowLeft', 'ArrowRight'].includes(event.key))
            return;
          event.preventDefault();
          moveBy(event.key === 'ArrowLeft' ? -16 : 16);
        }}
        onPointerEnter={trackPointer}
        onPointerMove={trackPointer}
        onPointerLeave={() => {
          if (hovered.current) {
            hovered.current = false;
            engage();
          }
        }}
        onFocus={(event) => {
          focused.current = event.currentTarget.matches(':focus-visible');
          engage();
        }}
        onBlur={() => {
          focused.current = false;
          engage();
        }}
      >
        <Image
          src={image}
          alt=""
          width={480}
          height={480}
          loading={eager ? 'eager' : 'lazy'}
          unoptimized
          draggable={false}
          className="living-pet-fallback"
        />
        <canvas
          ref={canvas}
          width={PET_RESOLUTION}
          height={PET_RESOLUTION}
          aria-hidden="true"
        />
        {celebrating && (
          <span className="pet-hearts" aria-hidden="true" key={reaction}>
            {[0, 1, 2].map((i) => (
              <span className="pet-heart" key={i}>
                ♥
              </span>
            ))}
          </span>
        )}
      </button>
      <span className="sr-only" id={hintId}>
        Hover or focus to say hello. Click, tap, or press Enter or Space for a
        little love.{' '}
        {moveBy && 'Drag or use the left and right arrow keys to move.'}
      </span>
      {!onMessage && (
        <span className="pet-feedback" role="status">
          {feedback}
        </span>
      )}
    </div>
  );
}
