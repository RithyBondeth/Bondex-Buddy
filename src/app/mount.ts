import { FOCUS_MS, SpiritEngine, formatCountdown } from '../engine/spirit';
import type { Mood } from '../engine/spirit';
import { Ambience } from '../audio/ambience';
import { AnimationClock } from '../rendering/animation-clock';
import {
  observeActivity,
  observeHover,
  observeVisibility,
  isDesktop,
  revealHabitat,
  setControlsVisible,
  updateHitMask,
} from '../platform/desktop';
import { createHabitatRenderer } from '../rendering/habitat';

export async function mountApp(root: HTMLElement): Promise<() => void> {
  const engine = new SpiritEngine(Date.now());
  const audio = new Ambience();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const habitat = document.createElement('div');
  habitat.className = 'habitat';
  const pet = document.createElement('button');
  pet.className = 'pet';
  pet.type = 'button';
  pet.setAttribute('aria-label', 'Greet the test spirit');
  pet.title = 'Say hello. Hover here for focus controls.';
  const canvas = document.createElement('canvas');
  canvas.width = 110;
  canvas.height = 100;
  canvas.setAttribute('aria-hidden', 'true');
  pet.append(canvas);
  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.setAttribute('role', 'toolbar');
  controls.setAttribute('aria-label', 'Focus session');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.setAttribute('aria-label', 'Reset session without completion');
  const sound = document.createElement('button');
  sound.type = 'button';
  sound.textContent = 'Muted';
  sound.setAttribute('aria-label', 'Enable rain ambience and gentle chimes');
  sound.setAttribute('aria-pressed', 'false');
  sound.title =
    'Sound is off by default. Enable quiet procedural rain and chimes.';
  controls.append(toggle, reset, sound);
  const moodLabel = document.createElement('p');
  moodLabel.className = 'mood-label';
  const announcement = document.createElement('span');
  announcement.className = 'sr-only';
  announcement.setAttribute('role', 'status');
  habitat.append(pet, controls, moodLabel, announcement);
  root.replaceChildren(habitat);

  const renderer = await createHabitatRenderer(canvas);
  let disposed = false;
  let hovering = false;
  let visible = false;
  let lastMood: Mood | undefined;
  let moodStartedAt = performance.now();
  let lastMask: number[] | undefined;
  let completed = 0;
  let habitatVisible = false;
  let lastAnnouncement = '';
  // Serialize native updates so older masks or hover commands cannot overtake new ones.
  let updates = Promise.resolve();
  const enqueue = (operation: () => Promise<void>) => {
    updates = updates
      .then(() => {
        if (!disposed) return operation();
      })
      .catch((error: unknown) => {
        console.error('Desktop update failed:', error);
        moodLabel.title =
          'A desktop update failed. Quit from the tray and reopen.';
      });
  };
  const updateControls = () => {
    const next =
      hovering || (document.hasFocus() && habitat.matches(':focus-within'));
    if (next === visible) return;
    visible = next;
    habitat.classList.toggle('show-controls', visible);
    enqueue(() => setControlsVisible(visible));
  };
  habitat.addEventListener('pointerenter', () => {
    if (isDesktop()) return;
    hovering = true;
    updateControls();
  });
  habitat.addEventListener('pointerleave', () => {
    if (isDesktop()) return;
    hovering = false;
    updateControls();
  });
  habitat.addEventListener('focusin', updateControls);
  habitat.addEventListener('focusout', () => queueMicrotask(updateControls));
  window.addEventListener('focus', updateControls);
  window.addEventListener('blur', updateControls);

  const render = (initial = false): number[] | undefined => {
    const now = Date.now();
    const date = new Date(now);
    const snapshot = engine.read(now, date.getHours() * 60 + date.getMinutes());
    let mask: number[] | undefined;
    if (lastMood !== snapshot.mood) {
      moodStartedAt = performance.now();
      mask = renderer.draw(snapshot.mood, 0, motion.matches);
      lastMask = mask;
      if (!initial) enqueue(() => updateHitMask(mask!));
      lastMood = snapshot.mood;
    }
    if (snapshot.completedFocusSessions > completed) audio.chime(true);
    completed = snapshot.completedFocusSessions;
    const timer = snapshot.timer;
    const label = timer
      ? timer.status === 'paused'
        ? 'Resume'
        : 'Pause'
      : 'Start';
    toggle.textContent = `${label} ${formatCountdown(timer?.remainingMs ?? FOCUS_MS)}`;
    toggle.setAttribute(
      'aria-label',
      `${label} ${timer?.phase.toLowerCase() ?? 'focus'} session`,
    );
    toggle.title = timer
      ? `${timer.phase} ${timer.status}`
      : 'Start a 25-minute focus session';
    reset.disabled = !timer;
    moodLabel.textContent = `${snapshot.mood}${timer?.status === 'paused' ? ' · paused' : ''}`;
    moodLabel.title = snapshot.activityAvailable
      ? 'System idle time is available; no input content is collected.'
      : 'System activity unavailable. Manual focus sessions still work.';
    const message = `${snapshot.mood}. ${timer ? `${timer.phase} ${timer.status}.` : 'No focus session running.'}`;
    if (message !== lastAnnouncement) {
      announcement.textContent = message;
      lastAnnouncement = message;
    }
    return mask;
  };
  const unsubscribeHover = await observeHover((inside) => {
    hovering = inside;
    updateControls();
  });
  try {
    await revealHabitat(render(true)!);
  } catch (error) {
    unsubscribeHover();
    throw error;
  }
  const unsubscribeActivity = await observeActivity((reading) => {
    engine.observeActivity(reading, Date.now());
    render();
  });
  const animation = new AnimationClock((time, reduced) => {
    const mask = renderer.draw(
      lastMood ?? 'Idle',
      time - moodStartedAt,
      reduced,
    );
    if (mask !== lastMask) {
      lastMask = mask;
      enqueue(() => updateHitMask(mask));
    }
  });
  const syncMotion = () => animation.setState(habitatVisible, motion.matches);
  motion.addEventListener('change', syncMotion);
  const unsubscribeVisibility = await observeVisibility((visible) => {
    habitatVisible = visible;
    audio.setVisible(visible);
    syncMotion();
  });
  pet.addEventListener('click', () => {
    engine.interact(Date.now());
    audio.chime();
    render();
  });
  toggle.addEventListener('click', () => {
    engine.toggleTimer(Date.now());
    render();
  });
  reset.addEventListener('click', () => {
    engine.resetTimer(Date.now());
    render();
  });
  sound.addEventListener('click', () => {
    sound.disabled = true;
    void audio
      .setEnabled(!audio.enabled)
      .then((enabled) => {
        sound.textContent = enabled ? 'Sound' : 'Muted';
        sound.title = enabled
          ? 'Mute rain ambience and chimes.'
          : 'Enable quiet procedural rain and chimes.';
        sound.setAttribute('aria-pressed', String(enabled));
        sound.setAttribute(
          'aria-label',
          enabled
            ? 'Mute ambience and chimes'
            : 'Enable rain ambience and gentle chimes',
        );
      })
      .catch(() => {
        sound.textContent = 'Retry';
        sound.title = 'Audio could not start. Click to try again.';
        sound.setAttribute('aria-pressed', 'false');
      })
      .finally(() => {
        sound.disabled = false;
      });
  });
  const interval = setInterval(render, 1000);
  const dispose = () => {
    disposed = true;
    clearInterval(interval);
    unsubscribeHover();
    unsubscribeActivity();
    unsubscribeVisibility();
    motion.removeEventListener('change', syncMotion);
    animation.dispose();
    audio.dispose();
    window.removeEventListener('focus', updateControls);
    window.removeEventListener('blur', updateControls);
    window.removeEventListener('beforeunload', dispose);
  };
  window.addEventListener('beforeunload', dispose);
  return dispose;
}
