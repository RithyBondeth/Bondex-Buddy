'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { HabitatAmbience } from '@/components/habitat-ambience';
import { LivingPet } from '@/components/ui/living-pet';
import { companions } from '@/lib/companions';
import { useCalmMotion } from '@/components/motion-preferences';

export const HABITAT_SIZES =
  '(max-width: 477px) 88vw, (max-width: 767px) 420px, (max-width: 1050px) 46vw, 460px';

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
  const [offset, setOffset] = useState(0);
  const moveBy = (distance: number) => {
    const width = layer.current?.getBoundingClientRect().width;
    if (width)
      setOffset((previous) =>
        Math.max(-23, Math.min(23, previous + (100 * distance) / width)),
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
      initial={reduce ? false : { opacity: 0, y: 10, scale: 1.015 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.985 }}
      transition={{ duration: reduce ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <Image
        className="habitat-island"
        src={companion.habitat.image}
        alt=""
        width={1536}
        height={1024}
        sizes={HABITAT_SIZES}
        loading="eager"
      />
      <div
        className="habitat-ground-shadow"
        aria-hidden="true"
        style={{ left: `${41 + offset}%` }}
      />
      <div
        className="habitat-pet"
        data-companion={companion.id}
        style={{ left: `${31.5 + offset}%` }}
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
      </div>
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
  const reduce = useCalmMotion();
  return (
    <div
      className="habitat-scene"
      data-active-habitat={companion.habitat.id}
      aria-busy={loading}
    >
      <motion.div
        className="habitat-sky"
        initial={false}
        animate={{ backgroundColor: companion.background }}
        transition={{ duration: reduce ? 0 : 0.65 }}
        aria-hidden="true"
      />
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
