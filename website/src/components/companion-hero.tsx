'use client';

import Image from 'next/image';
import { useState, useReducer } from 'react';
import { motion, type Variants } from 'motion/react';
import {
  CompanionHabitat,
  HABITAT_SIZES,
  habitatDimensions,
} from '@/components/companion-habitat';
import {
  createHabitatSelection,
  reduceHabitatSelection,
} from '@/lib/habitat-selection';
import { avengers, companions } from '@/lib/companions';
import { easeOut } from '@/lib/motion';
import { useCalmMotion } from '@/components/motion-preferences';
import { GridPulse } from '@/components/ui/grid-pulse';
import '../../shared/pocket-themes.css';
import { abilityNames } from '../../shared/abilities';
import './companion-hero.css';

const entrance: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.72, ease: easeOut } },
};

const stillEntrance: Variants = {
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

const entranceGroup: Variants = {
  visible: { transition: { staggerChildren: 0.075 } },
};

const roster = [...companions, ...avengers];

export function CompanionHero() {
  const [habitat, dispatch] = useReducer(
    reduceHabitatSelection,
    roster.length,
    createHabitatSelection,
  );
  const selected = habitat.current;
  const loading = habitat.requested !== selected;
  const [showAvengers, setShowAvengers] = useState(false);
  const firstChoice = showAvengers ? companions.length : 0;
  const choices = showAvengers ? avengers : companions;
  const [petMessage, setPetMessage] = useState<{
    pet: string;
    text: string;
  } | null>(null);
  const companion = roster[selected];
  const reduce = useCalmMotion();
  const choose = (index: number) => {
    setPetMessage(null);
    dispatch({ type: 'request', index });
  };
  const switchRoster = (heroes: boolean) => {
    if (heroes === showAvengers) return;
    setShowAvengers(heroes);
    choose(heroes ? companions.length : 0);
  };

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <GridPulse cell={32} ambient={2} />
      <motion.div
        className="hero-copy"
        data-reveal
        initial={reduce ? false : 'hidden'}
        animate="visible"
        variants={reduce ? undefined : entranceGroup}
      >
        <motion.div
          className="hero-eyebrow"
          data-grid-avoid
          data-reveal
          variants={reduce ? stillEntrance : entrance}
        >
          <span className="tiny-pixels" aria-hidden="true" /> Pixel pets for
          your desktop
        </motion.div>
        <motion.h1
          id="hero-heading"
          data-grid-avoid
          data-reveal
          variants={reduce ? stillEntrance : entrance}
        >
          Your desktop,
          <br />
          <span>a little cozier.</span>
        </motion.h1>
        <motion.p
          data-grid-avoid
          data-reveal
          variants={reduce ? stillEntrance : entrance}
        >
          Meet Ember, a pixel fox who keeps you company while you work, reminds
          you to take breaks, and keeps your everyday tools close.
        </motion.p>
        <motion.div
          className="hero-actions"
          data-reveal
          variants={reduce ? stillEntrance : entrance}
        >
          <a
            className="button button-primary"
            href="#how-it-works"
            data-grid-avoid
          >
            Try the focus timer{' '}
            <span className="button-arrow" aria-hidden="true">
              ↓
            </span>
          </a>
          <a className="text-link" href="#companions" data-grid-avoid>
            Meet the companions <span aria-hidden="true">↗</span>
          </a>
        </motion.div>
        <motion.p
          className="platforms"
          data-grid-avoid
          data-reveal
          variants={reduce ? stillEntrance : entrance}
        >
          For macOS and Windows
        </motion.p>
      </motion.div>
      <motion.div
        id="habitat-preview"
        className="hero-showcase"
        data-pocket-theme={companion.id}
        aria-label="Interactive companion habitat"
        data-reveal
        initial={reduce ? false : { opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reduce ? 0 : 0.86,
          delay: reduce ? 0 : 0.1,
          ease: easeOut,
        }}
      >
        <div className="habitat-shell">
          <div className="habitat-heading">
            <span className="habitat-title">{companion.habitat.label}</span>
            <span className="habitat-light">{companion.habitat.light}</span>
          </div>
          <div className="habitat-preloads" aria-hidden="true">
            {roster.map((pet, index) => {
              if (index >= companions.length && index !== habitat.requested)
                return null;
              return (
                <Image
                  key={`${pet.id}-${habitat.attempts[index]}`}
                  src={pet.habitat.image}
                  alt=""
                  {...habitatDimensions(pet.habitat)}
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
              );
            })}
          </div>
          <CompanionHabitat
            companion={companion}
            loading={loading}
            onMessage={(pet, text) => setPetMessage({ pet, text })}
          />
          <div className="habitat-meta">
            <div className="stage-name" aria-live="polite">
              <motion.div
                key={companion.id}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: easeOut }}
              >
                <div className="companion-name">
                  <span>{companion.name}</span>
                  <span className="companion-status">{companion.status}</span>
                </div>
                <small>
                  {petMessage?.pet === companion.id && petMessage.text
                    ? petMessage.text
                    : companion.trait}
                </small>
              </motion.div>
            </div>
            <div
              className="roster-switch"
              role="group"
              aria-label="Companion roster"
            >
              <button
                type="button"
                aria-pressed={!showAvengers}
                onClick={() => switchRoster(false)}
              >
                Desk spirits
              </button>
              <button
                type="button"
                aria-pressed={showAvengers}
                onClick={() => switchRoster(true)}
              >
                Avengers
              </button>
            </div>
          </div>
          <div className="habitat-controls">
            <div
              className={
                showAvengers ? 'pet-picker avengers-picker' : 'pet-picker'
              }
              role="group"
              aria-label="Preview a companion"
            >
              {choices.map((pet, i) => (
                <button
                  key={pet.id}
                  type="button"
                  aria-pressed={habitat.requested === firstChoice + i}
                  aria-label={
                    'species' in pet ? `${pet.name}, ${pet.species}` : pet.name
                  }
                  onClick={() => choose(firstChoice + i)}
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
                  {habitat.requested === firstChoice + i && (
                    <motion.span
                      className="choice-indicator"
                      layoutId="pet-choice-indicator"
                      transition={{
                        duration: reduce ? 0 : 0.38,
                        ease: easeOut,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
            <p className="pet-interaction-hint" role="status">
              {habitat.error !== null
                ? `${roster[habitat.error].name}’s scene couldn’t load. Choose them again to retry.`
                : loading
                  ? `Getting ${roster[habitat.requested].name}’s habitat ready…`
                  : `Click to play ${abilityNames[companion.id]} · Drag to move`}
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
