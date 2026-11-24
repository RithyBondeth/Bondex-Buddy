import Image from 'next/image';
import { motion } from 'motion/react';
import { useCalmMotion } from './motion-preferences';
import { easeOut } from '@/lib/motion';
import { avengers } from '@/lib/companions';
import { abilityNames } from '../../shared/abilities';
import './avengers-lineup.css';

export function AvengersLineup({
  onChoose,
  active,
}: {
  onChoose: (index: number) => void;
  active: string;
}) {
  const calm = useCalmMotion();

  return (
    <section
      className="field-section avengers-lineup"
      id="avengers"
      aria-labelledby="avengers-title"
    >
      <header className="lineup-intro">
        <h2 id="avengers-title">
          Meet the <em>Avengers.</em>
        </h2>
        <p>
          Pick a hero to enter their habitat. Click the pet to see its signature
          move.
        </p>
      </header>
      <ul className="lineup-panels">
        {avengers.map((hero, index) => (
          <motion.li
            key={hero.id}
            initial={false}
            whileInView={calm ? undefined : { y: [20, 0], opacity: [0.65, 1] }}
            transition={{
              duration: 0.65,
              ease: easeOut,
              delay: (index % 4) * 0.07,
            }}
            viewport={{ once: true, amount: 0.22 }}
            data-reveal
          >
            <a
              className="lineup-panel"
              data-pocket-theme={hero.id}
              href="#habitat-preview"
              aria-current={hero.id === active ? true : undefined}
              aria-label={`Preview ${hero.name} in the ${hero.habitat.label} habitat`}
              onClick={() => onChoose(index)}
            >
              <span className="lineup-frame" aria-hidden="true">
                <Image
                  className="lineup-scene"
                  src={hero.habitat.image}
                  alt=""
                  fill
                  sizes={
                    index === 0
                      ? '(max-width: 540px) 88vw, (max-width: 900px) 58vw, 650px'
                      : '(max-width: 540px) 44vw, (max-width: 900px) 30vw, 320px'
                  }
                />
                <span className="lineup-aura" />
                <span className="lineup-orbit" />
                <Image
                  className="lineup-sprite"
                  src={hero.image}
                  alt=""
                  width={128}
                  height={128}
                  unoptimized
                />
              </span>
              <span className="lineup-caption">
                <strong>{hero.name}</strong>
                <small>{abilityNames[hero.id]}</small>
                <span className="lineup-arrow" aria-hidden="true">
                  [&gt;]
                </span>
              </span>
            </a>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
