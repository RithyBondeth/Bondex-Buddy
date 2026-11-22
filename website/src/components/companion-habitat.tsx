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
import { companions } from '@/lib/companions';
import { easeInOut } from '@/lib/motion';
import { useCalmMotion } from '@/components/motion-preferences';

export const HABITAT_SIZES =
  '(max-width: 477px) 88vw, (max-width: 767px) 460px, (max-width: 1160px) 46vw, 520px';

type Companion = (typeof companions)[number];

function HabitatLayer({
  companion,
  onMessage,
}: {
  companion: Companion;
  onMessage: (pet: string, text: string) => void;
}) {
  const present = useIsPresent();
  const layer = useRef<HTMLDivElement>(null);
  const offset = useMotionValue(0);
  const shadowX = useTransform(
    offset,
    (distance) => `${(distance / 18) * 100}%`,
  );
  const petX = useTransform(offset, (distance) => `${(distance / 33) * 100}%`);
  const moveBy = (distance: number) => {
    const width = layer.current?.getBoundingClientRect().width;
    if (width)
      offset.set(
        Math.max(-23, Math.min(23, offset.get() + (100 * distance) / width)),
      );
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
      <div
        className="habitat-glow"
        style={{ backgroundColor: companion.background }}
        aria-hidden="true"
      />
      <Image
        className="habitat-island"
        src={companion.habitat.image}
        alt=""
        width={1536}
        height={1024}
        sizes={HABITAT_SIZES}
        loading="eager"
      />
      <motion.div
        className="habitat-ground-shadow"
        aria-hidden="true"
        style={{ x: shadowX }}
      />
      <motion.div
        className="habitat-pet"
        data-companion={companion.id}
        style={{ x: petX }}
      >
        <div className="main-pet">
          <LivingPet
            kind={companion.id}
            name={companion.name}
            image={companion.image}
            eager
            moveBy={moveBy}
            onMessage={(text) => onMessage(companion.id, text)}
          />
        </div>
      </motion.div>
      <HabitatAmbience habitat={companion.habitat.id} active={present} />
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
      aria-busy={loading}
    >
      <div className="habitat-sky" aria-hidden="true" />
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
