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
  title: pet.name,
  description: pet.description,
  action:
    i === 0
      ? { label: 'Try the focus timer', href: '#how-it-works' }
      : undefined,
}));

const tools = [
  {
    icon: '◷',
    title: 'Focus & tasks',
    description: 'Start a focus session, track your to-dos, and set reminders.',
  },
  {
    icon: '▤',
    title: 'Clips & files',
    description:
      'Find a recent clip or tuck a temporary copy into the File Pouch.',
  },
  {
    icon: '✦',
    title: 'Breaks & handoffs',
    description: 'Take a water break or see when a coding agent needs you.',
  },
] as const;

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
          <a href="#desktop-tools">Desktop tools</a>
          <a href="#companions">Companions</a>
          <MotionToggle />
          <a className="button button-small" href="#get-the-app">
            Release status{' '}
            <span className="button-arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        </nav>
      </header>
      <main id="main-content">
        <CompanionHero />
        <section
          className="tools-section"
          id="desktop-tools"
          aria-labelledby="tools-heading"
        >
          <Reveal>
            <h2 id="tools-heading">Inside Ember’s pocket</h2>
          </Reveal>
          <div className="tool-cards">
            {tools.map((tool, i) => (
              <Reveal key={tool.title} delay={i * 0.07}>
                <span className="tool-icon" aria-hidden="true">
                  {tool.icon}
                </span>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
              </Reveal>
            ))}
          </div>
        </section>
        <section
          id="how-it-works"
          className="ritual-section"
          aria-labelledby="ritual-heading"
        >
          <Reveal>
            <h2 id="ritual-heading">
              A timer with <span className="pixel-accent">company.</span>
            </h2>
            <p>
              Try a 25-minute focus session or take a five-minute break. Ember
              changes pose to match what you’re doing.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <FocusPlayground />
          </Reveal>
        </section>
        <section
          className="companions-intro"
          id="companions"
          aria-labelledby="companions-heading"
        >
          <Reveal>
            <h2 id="companions-heading">
              Meet the <span className="pixel-accent">companions.</span>
            </h2>
            <p>
              Try Ember, Moon, Moss, or one of the seven Avengers. Each brings a
              signature ability and a matching desktop pocket.
            </p>
          </Reveal>
          <a className="text-link" href="#habitat-preview">
            Back to the habitat <span aria-hidden="true">↑</span>
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
          <GridPulse cell={32} ambient={2} />
          <div className="download-content">
            <Reveal>
              <div className="download-pets" aria-hidden="true" data-grid-avoid>
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
              <h2 id="download-heading" data-grid-avoid>
                Bring Ember to{' '}
                <span className="pixel-accent">your desktop.</span>
              </h2>
              <p data-grid-avoid>
                Bondex Buddy is in development for macOS and Windows.
              </p>
              <a
                className="button button-primary"
                href={repository}
                data-grid-avoid
              >
                Follow on GitHub{' '}
                <span className="button-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
              <p className="release-note" data-grid-avoid>
                Public downloads are planned for a future release.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <a href="#" className="brand">
            <span className="brand-symbol" aria-hidden="true" />
            bondex<span className="brand-light">buddy</span>
          </a>
          <div>
            <a href={`${repository}/blob/develop/PRIVACY.md`}>Privacy</a>
            <a href={repository}>GitHub ↗</a>
            <a href="#main-content">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </>
  );
}
