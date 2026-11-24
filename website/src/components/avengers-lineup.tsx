import Image from 'next/image';
import { avengers } from '@/lib/companions';
import { abilityNames } from '../../shared/abilities';
import './avengers-lineup.css';

export function AvengersLineup({
  onChoose,
}: {
  onChoose: (index: number) => void;
}) {
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
          <li key={hero.id}>
            <a
              className="lineup-panel"
              data-pocket-theme={hero.id}
              href="#habitat-preview"
              aria-label={`Preview ${hero.name} in the ${hero.habitat.label} habitat`}
              onClick={() => onChoose(index)}
            >
              <span className="lineup-frame" aria-hidden="true">
                <Image
                  className="lineup-scene"
                  src={hero.habitat.image}
                  alt=""
                  fill
                  sizes="(max-width: 540px) 47vw, (max-width: 960px) 28vw, 180px"
                />
                <span className="lineup-aura" />
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
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
