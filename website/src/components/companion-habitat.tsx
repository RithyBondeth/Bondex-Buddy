'use client';

import Image from 'next/image';
import { useRef } from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useMotionValue,
  useTransform,
} from 'motion/react';
import { HabitatAmbience } from '@/components/habitat-ambience';
import { LivingPet } from '@/components/ui/living-pet';
import type { Companion } from '@/lib/companions';
import { easeInOut } from '@/lib/motion';
import { useCalmMotion } from '@/components/motion-preferences';

export const HABITAT_SIZES =
  '(max-width: 523px) 88vw, (max-width: 767px) 460px, (max-width: 1340px) 42vw, 590px';

export const HABITAT_DIMENSIONS = { width: 768, height: 512 };

function HabitatLayer({
  companion,
  onMessage,
}: {
  companion: Companion;
  onMessage: (pet: string, text: string) => void;
}) {
  const present = useIsPresent();
  const layer = useRef<HTMLDivElement>(null);
  const hero = 'kind' in companion;
  const petWidth = hero ? 27 : companion.id === 'blue-jelly' ? 28 : 33;
  const ground = hero ? companion.habitat.ground : undefined;
  const offset = useMotionValue(0);
  const shadowX = useTransform(
    offset,
    (distance) => `${(distance / 18) * 100}%`,
  );
  const petX = useTransform(
    offset,
    (distance) => `${(distance / petWidth) * 100}%`,
  );
  const moveBy = (distance: number) => {
    const width = layer.current?.getBoundingClientRect().width;
    if (!width) return 0;
    const previous = offset.get();
    const next = Math.max(
      -23,
      Math.min(23, previous + (100 * distance) / width),
    );
    offset.set(next);
    return (next - previous) / petWidth;
  };
  const reduce = useCalmMotion();
  return (
    <motion.div
      ref={layer}
      className="habitat-layer"
      data-habitat={companion.habitat.id}
      aria-hidden={!present}
      inert={!present}
      style={{ zIndex: present ? 1 : 0 }}
      initial={reduce ? false : { opacity: 0, y: 9, scale: 1.018 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduce ? 0 : -5, scale: reduce ? 1 : 0.99 }}
      transition={{ duration: reduce ? 0 : 0.68, ease: easeInOut }}
    >
      <Image
        className="habitat-background"
        src={companion.habitat.image}
        alt=""
        {...HABITAT_DIMENSIONS}
        sizes={HABITAT_SIZES}
        loading="eager"
      />
      <motion.div
        className="habitat-ground-shadow"
        aria-hidden="true"
        style={{
          x: shadowX,
          bottom: ground === undefined ? undefined : `${ground - 1.5}%`,
        }}
      />
      <motion.div
        className="habitat-pet"
        data-companion={companion.id}
        style={{
          x: petX,
          width: `${petWidth}%`,
          left: `${(100 - petWidth) / 2}%`,
          // The sprite has transparent padding below its feet.
          bottom: ground === undefined ? undefined : `${ground - 4.5}%`,
        }}
      >
        <div className="main-pet">
          <LivingPet
            kind={hero ? companion.kind : companion.id}
            hero={hero ? companion.id : undefined}
            name={companion.name}
            image={companion.image}
            eager
            moveBy={moveBy}
            onMessage={(text) => onMessage(companion.id, text)}
          />
        </div>
      </motion.div>
      {!hero && (
        <HabitatAmbience habitat={companion.habitat.id} active={present} />
      )}
    </motion.div>
  );
}

export function CompanionHabitat({
  companion,
  loading,
  onMessage,
}: {
  companion: Companion;
  loading: boolean;
  onMessage: (pet: string, text: string) => void;
}) {
  return (
    <div
      className="habitat-scene"
      data-active-habitat={companion.habitat.id}
      data-roster={'kind' in companion ? 'avengers' : undefined}
      aria-busy={loading}
    >
      <HabitatWorld companion={companion} onMessage={onMessage} />
    </div>
  );
}

function HabitatWorld({
  companion,
  onMessage,
}: {
  companion: Companion;
  onMessage: (pet: string, text: string) => void;
}) {
  return (
    <div className="habitat-world">
      <AnimatePresence initial={false}>
        <HabitatLayer
          key={companion.id}
          companion={companion}
          onMessage={onMessage}
        />
      </AnimatePresence>
    </div>
  );
}
