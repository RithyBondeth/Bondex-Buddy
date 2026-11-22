import Image from 'next/image';
import { CompanionHero } from '@/components/companion-hero';
import { FocusPlayground } from '@/components/focus-playground';
import { MotionToggle } from '@/components/motion-preferences';
import { GridPulse } from '@/components/ui/grid-pulse';
import { Reveal } from '@/components/ui/reveal';
import SplitCanvas, {
  type SplitCanvasItem,
} from '@/components/ui/split-canvas';
import { companions, repository } from '@/lib/companions';

const stories: SplitCanvasItem[] = companions.map((pet, i) => ({
  image: pet.image,
  label: pet.species,
  title:
    i === 0
      ? 'A small spark.\nA warm presence.'
      : i === 1
        ? 'For dreamers.\nAnd night thinkers.'
        : 'A slower pace.\nA greener space.',
  description: pet.description,
  action: {
    label:
      i === 0 ? 'Try a little focus time' : `${pet.name} is in development`,
    href: i === 0 ? '#how-it-works' : '#get-the-app',
  },
}));

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <a href="#" className="brand" aria-label="Bondex Buddy home">
          <span className="brand-symbol" aria-hidden="true" />
          bondex<span className="brand-light">buddy</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#companions">The companions</a>
          <a href="#how-it-works">Little rituals</a>
          <MotionToggle />
          <a className="button button-small" href="#get-the-app">
            Get the app <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <main id="main-content">
        <CompanionHero />
        <section
          className="manifesto-section"
          aria-labelledby="manifesto-heading"
        >
          <Reveal>
            <p className="section-label">Not another thing to keep up with.</p>
            <h2 id="manifesto-heading">
              Less noise.
              <br />
              More <span className="pixel-accent">nice to have you here.</span>
            </h2>
            <p>
              Some days need a productivity system.
              <br />
              Other days just need a little company.
            </p>
          </Reveal>
          <div className="manifesto-pets" aria-hidden="true">
            {companions.map((pet, i) => (
              <Reveal key={pet.id} delay={i * 0.12}>
                <Image
                  src={pet.image}
                  alt=""
                  width={130}
                  height={130}
                  unoptimized
                />
              </Reveal>
            ))}
          </div>
        </section>
        <section
          className="companions-intro"
          id="companions"
          aria-labelledby="companions-heading"
        >
          <Reveal>
            <div className="section-label">Find your kind of company</div>
            <h2 id="companions-heading">
              Tiny spirits.
              <br />
              <span className="pixel-accent">Their own little worlds.</span>
            </h2>
            <p>
              Meet the family we’re bringing to life. Ember leads the way;
              <br className="desktop-break" /> Moon and Moss are growing from
              our first character concepts.
            </p>
          </Reveal>
          <a className="text-link" href="#get-the-app">
            Follow their journey <span aria-hidden="true">↗</span>
          </a>
        </section>
        <div id="meet-ember">
          <SplitCanvas
            items={stories}
            gridSize={10}
            numSlices={36}
            canvasSize={560}
            gridOpacity={0.08}
            className="companion-story"
          />
        </div>
        <section
          id="how-it-works"
          className="ritual-section"
          aria-labelledby="ritual-heading"
        >
          <Reveal>
            <div className="section-label">A rhythm that feels like you</div>
            <h2 id="ritual-heading">
              Work a little.
              <br />
              <span className="pixel-accent">Live a little.</span>
            </h2>
            <p>
              A focus buddy, a break companion, or just a familiar face.
              <br className="desktop-break" /> No pressure to be anything more
              productive than yourself.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <FocusPlayground />
          </Reveal>
        </section>
        <section className="values-section" aria-label="Made with care">
          <Reveal>
            <span className="value-mark" aria-hidden="true">
              ↙
            </span>
            <h3>At home on your desktop.</h3>
            <p>
              A small habitat in the corner. Your work keeps the rest of the
              screen.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <span className="value-mark" aria-hidden="true">
              ⌂
            </span>
            <h3>Your little world stays yours.</h3>
            <p>
              Local progress. No accounts, tracking, or cloud saves in the
              desktop app.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <span className="value-mark" aria-hidden="true">
              ♪
            </span>
            <h3>Quiet is the default.</h3>
            <p>
              Sound starts muted. Gentle rain and chimes are there when you want
              them.
            </p>
          </Reveal>
        </section>
        <section
          id="get-the-app"
          className="download-section"
          aria-labelledby="download-heading"
        >
          <GridPulse cell={32} ambient={3} maxLit={70} />
          <div className="download-content">
            <Reveal>
              <div className="download-pets" aria-hidden="true">
                {companions.map((pet) => (
                  <Image
                    key={pet.id}
                    src={pet.image}
                    alt=""
                    width={140}
                    height={140}
                    unoptimized
                  />
                ))}
              </div>
              <p className="section-label" data-grid-avoid>
                A cozier desktop is taking shape.
              </p>
              <h2 id="download-heading" data-grid-avoid>
                Room for one
                <br />
                <span className="pixel-accent">more little friend?</span>
              </h2>
              <p data-grid-avoid>
                Follow the journey from the first pixels to the first release.
              </p>
              <a className="button button-primary" href={repository}>
                Follow on GitHub <span aria-hidden="true">↗</span>
              </a>
              <p className="release-note" data-grid-avoid>
                In development for macOS & Windows. Public downloads coming
                later.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <a href="#" className="brand">
            bondex<span className="brand-light">buddy</span>
          </a>
          <p>Little company. Big difference.</p>
          <div>
            <a href={`${repository}/blob/develop/PRIVACY.md`}>Privacy</a>
            <a href={repository}>GitHub ↗</a>
            <a href="#main-content">Back to top ↑</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>A tiny desk spirit project.</span>
          <span>Made with care. And a few pixels.</span>
        </div>
      </footer>
    </>
  );
}
