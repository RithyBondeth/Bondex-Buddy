'use client';

import Image from 'next/image';
import { useState, useReducer } from 'react';
import { motion, type Variants } from 'motion/react';
import blueJellyIcon from '@/app/icon.png';
import {
  CompanionHabitat,
  HABITAT_DIMENSIONS,
  HABITAT_SIZES,
} from '@/components/companion-habitat';
import {
  createHabitatSelection,
  reduceHabitatSelection,
} from '@/lib/habitat-selection';
import { avengers, companions } from '@/lib/companions';
import { easeOut } from '@/lib/motion';
import { useCalmMotion } from '@/components/motion-preferences';
import { AvengersLineup } from './avengers-lineup';
import { AsciiLandscape } from './ascii-landscape';
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
const avengersStart = companions.length;

export function CompanionHero() {
  const [habitat, dispatch] = useReducer(
    reduceHabitatSelection,
    roster.length,
    createHabitatSelection,
  );
  const selected = habitat.current;
  const loading = habitat.requested !== selected;
  const [showAvengers, setShowAvengers] = useState(false);
  const firstChoice = showAvengers ? avengersStart : 0;
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
    choose(heroes ? avengersStart : 0);
  };

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <AsciiLandscape />
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
            <Image
              className="hero-brand-icon"
              src={blueJellyIcon}
              alt=""
              width={24}
              height={24}
              unoptimized
            />
            Desktop companions
          </motion.div>
          <motion.h1
            id="hero-heading"
            data-grid-avoid
            data-reveal
            variants={reduce ? stillEntrance : entrance}
          >
            A little life
            <br />
            <span className="pixel-headline">
              <span className="sr-only">on your desk.</span>
              <span aria-hidden="true">
                {Array.from('on your desk.').map((letter, i) => (
                  <i key={i} style={{ animationDelay: `${120 + i * 32}ms` }}>
                    {letter === ' ' ? ' ' : letter}
                  </i>
                ))}
              </span>
            </span>
          </motion.h1>
          <motion.p
            data-grid-avoid
            data-reveal
            variants={reduce ? stillEntrance : entrance}
          >
            Meet Blue Jelly, a little jellyfish that floats beside your work.
            Pick a desktop companion to keep your focus timer, tasks, and files
            close at hand.
          </motion.p>
          <motion.div
            className="hero-actions"
            data-reveal
            variants={reduce ? stillEntrance : entrance}
          >
            <a
              className="button button-primary"
              href="#companions"
              data-grid-avoid
            >
              Meet the companions{' '}
              <span className="button-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
            <a className="text-link" href="#how-it-works" data-grid-avoid>
              Try a focus session <span aria-hidden="true">↗</span>
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
          role="region"
          tabIndex={-1}
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
            <div className="habitat-preloads" aria-hidden="true">
              {roster.map((pet, index) => {
                if (index !== habitat.requested) return null;
                return (
                  <Image
                    key={`${pet.id}-${habitat.attempts[index]}`}
                    src={pet.habitat.image}
                    alt=""
                    {...HABITAT_DIMENSIONS}
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
            <div className="habitat-screen">
              <div className="habitat-location">
                <span className="habitat-light">{companion.habitat.light}</span>
                <span className="habitat-title">{companion.habitat.label}</span>
              </div>
              <CompanionHabitat
                companion={companion}
                loading={loading}
                onMessage={(pet, text) => setPetMessage({ pet, text })}
              />
            </div>
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
                      'species' in pet
                        ? `${pet.name}, ${pet.species}`
                        : pet.name
                    }
                    data-pocket-theme={pet.id}
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
                    : `Tap pet for ${abilityNames[companion.id]} · Drag to move`}
              </p>
            </div>
          </div>
        </motion.div>
      </section>
      <AvengersLineup
        active={companion.id}
        onChoose={(index) => {
          setShowAvengers(true);
          choose(avengersStart + index);
        }}
      />
    </>
  );
}
