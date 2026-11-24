import Image from 'next/image';
import { CompanionHero } from '@/components/companion-hero';
import { FocusPlayground } from '@/components/focus-playground';
import { FieldBackground } from '@/components/field-background';
import { MotionToggle } from '@/components/motion-preferences';
import { Reveal } from '@/components/ui/reveal';
import { PocketGuide } from '@/components/pocket-guide';
import { companions, repository } from '@/lib/companions';
import './field-guide.css';

const habits = [
  [
    'Ember',
    'A fox on the move',
    'Ember pads across the desktop, picks up speed, and braces its paws to climb. Click the fox to open its pocket.',
  ],
  [
    'Moon',
    'A softer footfall',
    'Moon takes low, measured steps. In the habitat, click the cat to trace a constellation and send a comet across it.',
  ],
  [
    'Moss',
    'A little spring',
    'Moss gathers its hind legs before each hop. Its signature bloom sends butterflies up through a patch of wildflowers.',
  ],
] as const;
const questions = [
  [
    'How do I choose a companion?',
    'Open Settings → Companion → Desktop companion. Choose Ember, Moon, Moss, or one of seven Avengers. Your timer, tasks, and progress carry over when you switch.',
  ],
  [
    'Can my pet stay still?',
    'Turn off Playful roaming in Companion settings to park your pet. Roaming also pauses during focus sessions. The desktop app follows your system’s reduced-motion preference, and sound starts muted.',
  ],
  [
    'What stays on my device?',
    'Tasks, companion preferences, progress, and captured clipboard history live on your device. Clipboard capture is optional. The File Pouch stores temporary local copies, which expire after 24 hours by default.',
  ],
  [
    'How do water breaks work?',
    'Choose a reminder interval in Companion settings. Your pet visits with a water droplet when a break is due. Open its pocket to mark a drink, snooze for ten minutes, or skip the reminder.',
  ],
];
function Brand() {
  return (
    <a
      className="field-brand"
      href="#main-content"
      aria-label="Bondex Buddy home"
    >
      <Image src="/pets/idle.png" alt="" width={36} height={36} unoptimized />
      Bondex<span>Buddy</span>
    </a>
  );
}

export default function Home() {
  return (
    <FieldBackground>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#avengers">Avengers</a>
          <a href="#desktop-tools">Pocket tools</a>
          <a href="#companions">Companions</a>
          <MotionToggle />
          <a className="button button-small" href="#get-the-app">
            Get the app ↗
          </a>
        </nav>
      </header>
      <main id="main-content">
        <CompanionHero />
        <section
          className="field-section toolkit"
          id="desktop-tools"
          aria-labelledby="toolkit-title"
        >
          <Reveal>
            <p className="field-label">The pocket</p>
            <h2 id="toolkit-title">
              Small window.
              <br />
              <em>Useful things.</em>
            </h2>
            <p>
              Click your desktop pet or press Enter while it has focus. Four
              tabs keep everyday tools within reach. Explore each one here.
            </p>
          </Reveal>
          <PocketGuide />
        </section>
        <section
          className="field-section focus-lab"
          id="how-it-works"
          aria-labelledby="focus-title"
        >
          <Reveal>
            <p className="field-label">Interactive timer</p>
            <h2 id="focus-title">
              Find your <em>focus.</em>
            </h2>
            <p>
              Try the timer here. Ember settles into work for a focus session
              and changes pose for a break. In the desktop app, you can attach
              the session to a task and keep a count of completed rounds.
            </p>
          </Reveal>
          <Reveal>
            <FocusPlayground />
          </Reveal>
        </section>
        <section
          className="field-section bestiary"
          id="companions"
          aria-labelledby="pets-title"
        >
          <Reveal>
            <p className="field-label">Companion field guide</p>
            <h2 id="pets-title">
              Meet the <em>desk spirits.</em>
            </h2>
            <p>
              Watch them stroll to the screen edge, climb, pause for a grip, and
              find their way down. Each has its own gait, habitat, and pocket
              colors.
            </p>
          </Reveal>
          <div className="specimen-grid">
            {companions.map((pet, i) => (
              <Reveal key={pet.id} delay={i * 0.06}>
                <article className={'specimen specimen-' + pet.id}>
                  <div className="specimen-scene">
                    <Image
                      src={pet.habitat.image}
                      alt=""
                      fill
                      sizes="(max-width:700px) 90vw, 30vw"
                    />
                    <Image
                      className="specimen-pet"
                      src={pet.image}
                      alt=""
                      width={110}
                      height={110}
                      unoptimized
                    />
                  </div>
                  <div>
                    <small>
                      {pet.name} / {habits[i][1]}
                    </small>
                    <h3>{pet.species.replace(/^The /, '')}</h3>
                    <p>{habits[i][2]}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          <p className="roster-note">
            Prefer a superhero? The Avengers roster adds seven companions, from
            Spider-Man’s web swing to Thor’s thunder call.{' '}
            <a href="#avengers">Meet the team ↑</a>
          </p>
        </section>
        <section
          className="field-section field-faq"
          aria-labelledby="guide-title"
        >
          <Reveal>
            <p className="field-label">Desktop guide</p>
            <h2 id="guide-title">
              Make it <em>yours.</em>
            </h2>
          </Reveal>
          <div>
            {questions.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section
          className="field-release"
          id="get-the-app"
          aria-labelledby="release-title"
        >
          <div>
            <p className="field-label">macOS + Windows</p>
            <h2 id="release-title">
              Bring a buddy <em>home.</em>
            </h2>
            <p>
              Bondex Buddy is in development. Public downloads are planned for a
              future release. Follow the project or build the desktop app from
              source.
            </p>
            <div className="field-release-actions">
              <a className="button button-primary" href={repository}>
                View on GitHub ↗
              </a>
              <a
                className="text-link"
                href={repository + '/tree/develop#start-developing'}
              >
                Build from source →
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="field-footer">
        <Brand />
        <div>
          <a href={repository + '/blob/develop/PRIVACY.md'}>Privacy</a>
          <a href={repository}>GitHub ↗</a>
          <a href="#main-content">Back to top ↑</a>
        </div>
      </footer>
    </FieldBackground>
  );
}
