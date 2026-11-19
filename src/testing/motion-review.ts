import './motion-review.css';
import { AnimationClock } from '../rendering/animation-clock';
import { createHabitatRenderer } from '../rendering/habitat';
import { MOTION, poseAt } from '../rendering/motion';
import {
  restingPlay,
  samplePlayDemo,
  PLAY_DEMO_MS,
} from '../rendering/playful';
import type { Mood } from '../engine/spirit';
import type { Decor, Outfit } from '../engine/progress';

const moods = Object.keys(MOTION) as Mood[];
const input = <T extends HTMLElement>(id: string) =>
  document.querySelector<T>(`#${id}`)!;
const play = input<HTMLButtonElement>('play');
const restart = input<HTMLButtonElement>('restart');
const reduced = input<HTMLInputElement>('reduced');
const outfit = input<HTMLSelectElement>('outfit');
const decor = input<HTMLSelectElement>('decor');
const night = input<HTMLInputElement>('night');
const time = input<HTMLInputElement>('time');
const elapsed = input<HTMLOutputElement>('elapsed');
const checks = input<HTMLElement>('checks');
const featured = input<HTMLCanvasElement>('featured');
const featuredMood = input<HTMLElement>('featured-mood');
const greet = input<HTMLButtonElement>('greet');
const playDemo = input<HTMLButtonElement>('play-demo');
const descriptions: Record<Mood, string> = {
  Idle: 'A curious glance, a lazy tail swish.',
  Working: 'Quiet company while you focus.',
  Sleeping: 'Soft breaths. Sweet little dreams.',
  TeaBreak: 'A warm cup and a moment to pause.',
  Happy: 'Two happy hops, just for you.',
};
const labels: Record<Mood, string> = {
  Idle: 'Feeling curious',
  Working: 'In the flow',
  Sleeping: 'Dreaming away',
  TeaBreak: 'Taking it slow',
  Happy: 'Happy to see you',
};
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
reduced.checked = motionPreference.matches;
const scratch = document.createElement('canvas');
scratch.width = 110;
scratch.height = 100;

async function start(): Promise<void> {
  const renderer = await createHabitatRenderer(scratch);
  const context = scratch.getContext('2d')!;
  const featuredRenderer = await createHabitatRenderer(featured);
  // This review-only readback verifies rendered pixels; production drawing has no per-frame readback.
  let assertions = 0;
  const check = (condition: boolean) => {
    if (!condition) throw new Error(`Renderer check ${assertions + 1} failed`);
    assertions++;
  };
  const verifyMask = (mask: number[], exact: boolean) => {
    check(mask.length === 11000 && mask.every((v) => v === 0 || v === 1));
    const data = context.getImageData(0, 0, 110, 100).data;
    check(
      mask.every((v, i) =>
        exact ? v === Number(data[i * 4 + 3]! > 0) : !v || data[i * 4 + 3]! > 0,
      ),
    );
  };
  for (const mood of moods) {
    const neutral = renderer.draw(mood, 0, true);
    verifyMask(neutral, true);
    check(renderer.draw(mood, 999999, true) === neutral);
    let phase = 0;
    for (const beat of MOTION[mood]) {
      const mask = renderer.draw(mood, phase);
      verifyMask(mask, false);
      check(renderer.draw(mood, phase + 1) === mask);
      phase += beat.durationMs;
    }
    for (const selectedOutfit of ['none', 'beanie', 'scarf'] as Outfit[]) {
      for (const selectedDecor of ['none', 'plant', 'lantern'] as Decor[]) {
        verifyMask(
          renderer.draw(mood, 0, true, {
            outfit: selectedOutfit,
            decor: selectedDecor,
            night: false,
          }),
          true,
        );
      }
    }
  }
  // Exercise airborne silhouettes and natural gestures, including their wardrobe layers.
  for (const mood of moods) {
    for (let ms = 0; ms < 12000; ms += 100)
      verifyMask(renderer.draw(mood, ms), false);
    for (const selectedOutfit of ['beanie', 'scarf'] as Outfit[])
      for (const ms of [120, 200, 425, 650, 1000, 1190])
        verifyMask(
          renderer.draw(mood, ms, false, {
            outfit: selectedOutfit,
            decor: 'plant',
            night: true,
          }),
          false,
        );
  }
  for (const facing of [-1, 1] as const)
    for (const selectedOutfit of ['none', 'beanie', 'scarf'] as Outfit[])
      for (const action of ['walk', 'run', 'pounce', 'hide', 'peek'] as const)
        for (let ms = 0; ms < 1500; ms += 55) {
          const mask = renderer.draw('Idle', ms, false, {
            decor: 'lantern',
            outfit: selectedOutfit,
            night: false,
            play: {
              ...restingPlay(),
              roaming: true,
              action,
              facing,
              elapsedMs: ms,
            },
          });
          verifyMask(mask, true);
          check(mask.slice(110 * 97).every((pixel) => pixel === 0));
        }
  checks.textContent = `Renderer checks: ${assertions} passed · masks match solid pixels · cached poses reuse masks · reduced motion stays neutral`;
  const scenes = moods.map((mood) => {
    const figure = document.createElement('figure');
    const stage = document.createElement('div');
    stage.className = 'stage';
    const canvas = document.createElement('canvas');
    canvas.width = 110;
    canvas.height = 100;
    canvas.setAttribute('aria-label', `${mood} fox animation`);
    const caption = document.createElement('figcaption');
    caption.textContent = descriptions[mood];
    const title = document.createElement('span');
    title.className = 'mood-name';
    title.textContent = mood === 'TeaBreak' ? 'Tea break' : mood;
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'mood-choice';
    choice.setAttribute('aria-label', `Preview ${title.textContent}`);
    choice.setAttribute('aria-pressed', String(mood === 'Idle'));
    const output = document.createElement('output');
    output.hidden = true;
    stage.append(canvas);
    choice.append(stage, title);
    choice.addEventListener('click', () => {
      clearTimeout(greetingEnd);
      demoPlaying = false;
      playDemo.setAttribute('aria-pressed', 'false');
      playDemo.textContent = 'Watch Ember play ↔';
      selectedMood = mood;
      featuredStarted = current();
      sync();
    });
    figure.append(choice, caption);
    input('scenes').append(figure);
    return { mood, choice, output, context: canvas.getContext('2d')! };
  });
  let selectedMood: Mood = 'Idle';
  let demoPlaying = false;
  let demoStarted = 0;
  let featuredStarted = 0;
  let greetingEnd: ReturnType<typeof setTimeout> | undefined;
  let playing = true;
  let offset = 0;
  let startedAt = performance.now();
  const current = () => offset + (playing ? performance.now() - startedAt : 0);
  const draw = (ms: number) => {
    for (const scene of scenes) {
      renderer.draw(scene.mood, ms, reduced.checked, {
        outfit: outfit.value as Outfit,
        decor: decor.value as Decor,
        night: night.checked,
      });
      scene.context.clearRect(0, 0, 110, 100);
      scene.context.imageSmoothingEnabled = false;
      scene.context.drawImage(scratch, 0, 0);
      scene.output.textContent = poseAt(scene.mood, ms, reduced.checked);
    }
    const span = Math.max(
      24,
      Math.min(110, (greet.parentElement!.clientWidth - 180) / 2),
    );
    const demo = samplePlayDemo(ms - demoStarted, span);
    demo.play.roaming = demoPlaying;
    const activeDemo = demoPlaying && !reduced.checked;
    greet.parentElement!.classList.toggle('dock-demo', activeDemo);
    greet.style.transform = activeDemo
      ? `translate(${Math.round(demo.x / 3) * 3}px,${Math.round(demo.y / 3) * 3}px)`
      : '';
    featuredRenderer.draw(
      selectedMood,
      Math.max(0, ms - featuredStarted),
      reduced.checked,
      {
        outfit: outfit.value as Outfit,
        decor: decor.value as Decor,
        night: night.checked,
        play: demo.play,
      },
    );
    const actionLabels = {
      rest: 'Taking a breather',
      walk: 'Sneaking closer',
      run: 'A little burst of joy',
      pounce: 'Ready, set… pounce!',
      hide: 'Where did Ember go?',
      peek: 'Peekaboo!',
    };
    featuredMood.textContent = demoPlaying
      ? actionLabels[demo.play.action]
      : labels[selectedMood];
    for (const scene of scenes)
      scene.choice.setAttribute(
        'aria-pressed',
        String(scene.mood === selectedMood),
      );
    elapsed.textContent = `${Math.floor(ms)} ms`;
    time.value = String(Math.min(PLAY_DEMO_MS, ms));
  };
  const clock = new AnimationClock(() => draw(current()));
  const sync = () => {
    play.textContent = playing ? 'Pause motion' : 'Play motion';
    clock.setState(playing && !document.hidden, reduced.checked);
    draw(current());
  };
  play.addEventListener('click', () => {
    offset = current();
    startedAt = performance.now();
    playing = !playing;
    sync();
  });
  restart.addEventListener('click', () => {
    demoStarted = 0;
    featuredStarted = 0;
    offset = 0;
    startedAt = performance.now();
    sync();
  });
  time.addEventListener('input', () => {
    demoStarted = 0;
    clearTimeout(greetingEnd);
    playing = false;
    offset = Number(time.value);
    featuredStarted = 0;
    sync();
  });
  for (const control of [reduced, outfit, decor, night])
    control.addEventListener('change', sync);
  const hello = () => {
    demoPlaying = false;
    playDemo.setAttribute('aria-pressed', 'false');
    playDemo.textContent = 'Watch Ember play ↔';
    clearTimeout(greetingEnd);
    selectedMood = 'Happy';
    offset = current();
    startedAt = performance.now();
    featuredStarted = offset;
    playing = true;
    sync();
    greetingEnd = setTimeout(() => {
      selectedMood = 'Idle';
      featuredStarted = current();
      sync();
    }, 2000);
  };
  playDemo.addEventListener('click', () => {
    clearTimeout(greetingEnd);
    demoPlaying = !demoPlaying;
    playDemo.setAttribute('aria-pressed', String(demoPlaying));
    playDemo.textContent = demoPlaying
      ? 'Let Ember rest'
      : 'Watch Ember play ↔';
    selectedMood = 'Idle';
    offset = current();
    startedAt = performance.now();
    demoStarted = offset;
    playing = true;
    sync();
  });
  document
    .querySelectorAll<HTMLButtonElement>('[data-play-cue]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        clearTimeout(greetingEnd);
        demoPlaying = true;
        demoStarted = 0;
        selectedMood = 'Idle';
        playDemo.setAttribute('aria-pressed', 'true');
        playDemo.textContent = 'Let Ember rest';
        offset = Number(button.dataset.playCue);
        playing = false;
        sync();
      });
    });
  greet.addEventListener('click', hello);
  input('hello').addEventListener('click', hello);
  greet.addEventListener('pointermove', (event) => {
    const bounds = greet.getBoundingClientRect();
    featuredRenderer.setAttention(
      ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
    );
  });
  greet.addEventListener('pointerleave', () =>
    featuredRenderer.setAttention(null),
  );
  motionPreference.addEventListener('change', (event) => {
    reduced.checked = event.matches;
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener(
    'beforeunload',
    () => {
      clearTimeout(greetingEnd);
      clock.dispose();
    },
    { once: true },
  );
  sync();
}
void start().catch((error: unknown) => {
  checks.textContent = String(error);
});
