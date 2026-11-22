'use client';

import Image from 'next/image';
import { useState, useReducer } from 'react';
import { motion } from 'motion/react';
import {
  CompanionHabitat,
  HABITAT_SIZES,
} from '@/components/companion-habitat';
import {
  createHabitatSelection,
  reduceHabitatSelection,
} from '@/lib/habitat-selection';
import { companions } from '@/lib/companions';
import { useCalmMotion } from '@/components/motion-preferences';
import { GridPulse } from '@/components/ui/grid-pulse';
import './companion-hero.css';

export function CompanionHero() {
  const [habitat, dispatch] = useReducer(
    reduceHabitatSelection,
    companions.length,
    createHabitatSelection,
  );
  const selected = habitat.current;
  const loading = habitat.requested !== selected;
  const [petMessage, setPetMessage] = useState<{
    pet: string;
    text: string;
  } | null>(null);
  const companion = companions[selected];
  const reduce = useCalmMotion();

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <GridPulse
        interactive={false}
        cell={32}
        ambient={2}
        maxLit={60}
        reach={2.2}
      />
      <motion.div
        className="hero-copy"
        data-grid-avoid
        data-reveal
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-eyebrow">
          <span className="tiny-pixels" aria-hidden="true" /> Pixel pets for
          your desktop
        </div>
        <h1 id="hero-heading">
          Small friends.
          <br />
          <span>Big comfort.</span>
        </h1>
        <p>
          A quiet little friend for focus time, tea breaks, and everything in
          between.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#companions">
            Find your companion <span aria-hidden="true">↗</span>
          </a>
          <a className="text-link" href="#how-it-works">
            Try a focus session <span aria-hidden="true">↘</span>
          </a>
        </div>
        <div className="platforms">
          <span>Made for macOS & Windows</span>
        </div>
      </motion.div>
      <div className="hero-showcase" aria-label="Interactive companion habitat">
        <div className="habitat-heading">
          <span>{companion.habitat.label}</span>
          <span>{companion.habitat.light}</span>
        </div>
        <div className="habitat-preloads" aria-hidden="true">
          {companions.map((pet, index) => (
            <Image
              key={`${pet.id}-${habitat.attempts[index]}`}
              src={pet.habitat.image}
              alt=""
              width={1536}
              height={1024}
              sizes={HABITAT_SIZES}
              loading="eager"
              onLoad={() =>
                dispatch({
                  type: 'loaded',
                  index,
                  attempt: habitat.attempts[index],
                })
              }
              onError={() =>
                dispatch({
                  type: 'failed',
                  index,
                  attempt: habitat.attempts[index],
                })
              }
            />
          ))}
        </div>
        <CompanionHabitat
          companion={companion}
          loading={loading}
          onMessage={(pet, text) => setPetMessage({ pet, text })}
        />
        <div className="habitat-meta">
          <div className="stage-name" aria-live="polite">
            <div className="companion-name">
              <span>{companion.name}</span>
              <span className="companion-status">{companion.status}</span>
            </div>
            <small>
              {petMessage?.pet === companion.id && petMessage.text
                ? petMessage.text
                : companion.trait}
            </small>
          </div>
          <div
            className="pet-picker"
            role="group"
            aria-label="Preview a companion"
          >
            {companions.map((pet, i) => (
              <button
                key={pet.id}
                type="button"
                aria-pressed={habitat.requested === i}
                aria-label={`${pet.name}, ${pet.species}`}
                onClick={() => {
                  setPetMessage(null);
                  dispatch({ type: 'request', index: i });
                }}
                className="pet-choice"
              >
                <Image
                  src={pet.image}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                />
                <span>{pet.name}</span>
                {habitat.requested === i && (
                  <motion.span
                    className="choice-indicator"
                    layoutId="pet-choice-indicator"
                    transition={{
                      duration: reduce ? 0 : 0.3,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
        <p className="pet-interaction-hint" role="status">
          {habitat.error !== null
            ? `${companions[habitat.error].name}’s scene couldn’t load. Choose them again to retry.`
            : loading
              ? `Getting ${companions[habitat.requested].name}’s habitat ready…`
              : 'Drag a friend around or give them a head pat.'}
        </p>
      </div>
    </section>
  );
}
