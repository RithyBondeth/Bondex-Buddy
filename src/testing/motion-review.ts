import './motion-review.css';
import { AnimationClock } from '../rendering/animation-clock';
import { createHabitatRenderer } from '../rendering/habitat';
import { MOTION, poseAt } from '../rendering/motion';
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
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
reduced.checked = motionPreference.matches;
const scratch = document.createElement('canvas');
scratch.width = 110;
scratch.height = 100;

async function start(): Promise<void> {
  const renderer = await createHabitatRenderer(scratch);
  const context = scratch.getContext('2d')!;
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
    const title = document.createElement('h2');
    title.textContent = mood;
    const output = document.createElement('output');
    caption.append(title, output);
    stage.append(canvas);
    figure.append(stage, caption);
    input('scenes').append(figure);
    return { mood, output, context: canvas.getContext('2d')! };
  });
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
    elapsed.textContent = `${Math.floor(ms)} ms`;
    time.value = String(Math.min(5200, ms));
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
    offset = 0;
    startedAt = performance.now();
    sync();
  });
  time.addEventListener('input', () => {
    playing = false;
    offset = Number(time.value);
    sync();
  });
  for (const control of [reduced, outfit, decor, night])
    control.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('beforeunload', () => clock.dispose(), {
    once: true,
  });
  sync();
}
void start().catch((error: unknown) => {
  checks.textContent = String(error);
});
