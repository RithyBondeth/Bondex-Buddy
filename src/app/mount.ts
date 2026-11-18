import { FOCUS_MS, SpiritEngine, formatCountdown } from '../engine/spirit';
import type { Mood } from '../engine/spirit';
import { awardCompletions, canEquip, canWear } from '../engine/progress';
import type { Decor, Outfit } from '../engine/progress';
import { openProgressStore } from '../platform/progress-store';
import { Ambience } from '../audio/ambience';
import { AnimationClock } from '../rendering/animation-clock';
import {
  observeActivity,
  observeHover,
  observeVisibility,
  isDesktop,
  revealHabitat,
  setControlsVisible,
  setDrawerVisible,
  beginDrag,
  nudgeHabitat,
  setGhostMode,
  setWorking,
  observeGhost,
  updateHitMask,
} from '../platform/desktop';
import { createHabitatRenderer } from '../rendering/habitat';

export async function mountApp(root: HTMLElement): Promise<() => void> {
  const store = await openProgressStore();
  let progress = store.data;
  let saveProblem = store.readOnly;
  const engine = new SpiritEngine(Date.now());
  const audio = new Ambience();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const habitat = document.createElement('div');
  habitat.className = 'habitat';
  const pet = document.createElement('button');
  pet.className = 'pet';
  pet.type = 'button';
  pet.setAttribute('aria-label', 'Greet Ember fox');
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
  const items = document.createElement('button');
  items.type = 'button';
  items.textContent = 'Items';
  items.setAttribute('aria-expanded', 'false');
  items.setAttribute('aria-label', 'Open decor and lighting');
  controls.append(items);
  const drawer = document.createElement('div');
  drawer.className = 'items-drawer';
  drawer.hidden = true;
  drawer.setAttribute('role', 'group');
  drawer.setAttribute('aria-label', 'Decor and lighting');
  const progressLabel = document.createElement('span');
  progressLabel.className = 'progress-label';
  const decor = document.createElement('select');
  decor.setAttribute('aria-label', 'Desk decor');
  for (const [value, text] of [
    ['none', 'Bare desk'],
    ['plant', 'Plant · 1 focus'],
    ['lantern', 'Lantern · 3 focus'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    decor.append(option);
  }
  const lighting = document.createElement('select');
  lighting.setAttribute('aria-label', 'Habitat lighting');
  for (const [value, text] of [
    ['auto', 'Time of day'],
    ['day', 'Daylight'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    lighting.append(option);
  }
  drawer.append(progressLabel, decor, lighting);
  const outfit = document.createElement('select');
  outfit.setAttribute('aria-label', 'Fox outfit');
  for (const [value, text] of [
    ['none', 'No outfit'],
    ['beanie', 'Beanie · 2 focus'],
    ['scarf', 'Scarf · 5 focus'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    outfit.append(option);
  }
  const ghost = document.createElement('button');
  ghost.type = 'button';
  ghost.setAttribute('aria-label', 'Ghost Mode during work');
  ghost.title =
    'Fade and pass clicks through the fox during work. Controls remain usable.';
  ghost.disabled = !isDesktop();
  if (!isDesktop()) ghost.title = 'Ghost Mode is available in the desktop app.';
  drawer.append(outfit, ghost);
  const refreshItems = () => {
    progressLabel.textContent = saveProblem
      ? 'Progress stays in memory for now'
      : `${progress.completedFocusSessions} completed focus sessions`;
    progressLabel.title = saveProblem
      ? 'Existing progress could not be read or saved. Your existing file has been preserved.'
      : 'Unlocks are permanent. No streaks or penalties.';
    for (const option of decor.options)
      option.disabled = !canEquip(progress, option.value as Decor);
    decor.value = progress.decor;
    lighting.value = progress.lighting;
    for (const option of outfit.options)
      option.disabled = !canWear(progress, option.value as Outfit);
    outfit.value = progress.outfit;
    ghost.textContent = progress.ghost ? 'Ghost on' : 'Ghost off';
    ghost.setAttribute('aria-pressed', String(progress.ghost));
  };
  const persist = () => {
    refreshItems();
    void store
      .save(progress)
      .then(() => {
        saveProblem = false;
        refreshItems();
      })
      .catch(() => {
        saveProblem = true;
        refreshItems();
      });
  };
  refreshItems();
  const moodLabel = document.createElement('p');
  moodLabel.className = 'mood-label';
  const announcement = document.createElement('span');
  announcement.className = 'sr-only';
  announcement.setAttribute('role', 'status');
  const handle = document.createElement('button');
  handle.className = 'drag-handle';
  handle.type = 'button';
  handle.setAttribute(
    'aria-label',
    'Move habitat: drag shelf or use arrow keys',
  );
  handle.title = 'Drag the shelf to move. Arrow keys move by 24 pixels.';
  habitat.append(pet, handle, controls, drawer, moodLabel, announcement);
  root.replaceChildren(habitat);

  const renderer = await createHabitatRenderer(canvas);
  let disposed = false;
  let hovering = false;
  let visible = false;
  let drawerOpen = false;
  let drawerVisible = false;
  let lastMood: Mood | undefined;
  let lastAppearance = '';
  let wasWorking: boolean | undefined;
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
    if (!visible) {
      drawerOpen = false;
      syncDrawer();
    }
    enqueue(() => setControlsVisible(visible));
  };
  const syncDrawer = () => {
    const next = drawerOpen && visible;
    drawer.hidden = !next;
    habitat.classList.toggle('drawer-open', next);
    items.setAttribute('aria-expanded', String(next));
    if (drawerVisible !== next) {
      drawerVisible = next;
      enqueue(() => setDrawerVisible(next));
    }
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
    const working = snapshot.mood === 'Working';
    if (wasWorking !== working) {
      wasWorking = working;
      enqueue(() => setWorking(working));
    }
    let mask: number[] | undefined;
    const appearanceKey = JSON.stringify(appearance());
    if (lastMood !== snapshot.mood || lastAppearance !== appearanceKey) {
      if (lastMood !== snapshot.mood) moodStartedAt = performance.now();
      lastAppearance = appearanceKey;
      mask = renderer.draw(
        snapshot.mood,
        performance.now() - moodStartedAt,
        motion.matches,
        appearance(),
      );
      lastMask = mask;
      if (!initial) enqueue(() => updateHitMask(mask!));
      lastMood = snapshot.mood;
    }
    if (snapshot.completedFocusSessions > completed) {
      audio.chime(true);
      progress = awardCompletions(
        progress,
        snapshot.completedFocusSessions - completed,
      );
      persist();
    }
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
  const appearance = () => {
    const hour = new Date().getHours();
    return {
      outfit: progress.outfit,
      decor: progress.decor,
      night: progress.lighting === 'auto' && (hour >= 18 || hour < 6),
    };
  };
  const unsubscribeHover = await observeHover((inside) => {
    hovering = inside;
    updateControls();
  });
  const unsubscribeGhost = await observeGhost((ghost) =>
    habitat.classList.toggle('ghosted', ghost),
  );
  try {
    await setGhostMode(progress.ghost);
    await revealHabitat(render(true)!);
  } catch (error) {
    unsubscribeHover();
    unsubscribeGhost();
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
      appearance(),
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
    if (engine.interact(Date.now())) moodStartedAt = performance.now();
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
  items.addEventListener('click', () => {
    drawerOpen = !drawerOpen;
    syncDrawer();
  });
  habitat.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      drawerOpen = false;
      syncDrawer();
      items.focus();
    }
  });
  const redrawAppearance = () => {
    const mask = renderer.draw(
      lastMood ?? 'Idle',
      performance.now() - moodStartedAt,
      motion.matches,
      appearance(),
    );
    lastMask = mask;
    enqueue(() => updateHitMask(mask));
  };
  decor.addEventListener('change', () => {
    const choice = decor.value as Decor;
    if (!canEquip(progress, choice)) {
      refreshItems();
      return;
    }
    progress = { ...progress, decor: choice };
    persist();
    redrawAppearance();
  });
  outfit.addEventListener('change', () => {
    const choice = outfit.value as Outfit;
    if (!canWear(progress, choice)) {
      refreshItems();
      return;
    }
    progress = { ...progress, outfit: choice };
    persist();
    redrawAppearance();
  });
  ghost.addEventListener('click', () => {
    progress = { ...progress, ghost: !progress.ghost };
    persist();
    enqueue(() => setGhostMode(progress.ghost));
  });
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !isDesktop()) return;
    event.preventDefault();
    void beginDrag().catch(console.error);
  });
  handle.addEventListener('keydown', (event) => {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-24, 0],
      ArrowRight: [24, 0],
      ArrowUp: [0, -24],
      ArrowDown: [0, 24],
    };
    if (delta[event.key]) {
      event.preventDefault();
      void nudgeHabitat(...delta[event.key]).catch(console.error);
    }
  });
  lighting.addEventListener('change', () => {
    progress = {
      ...progress,
      lighting: lighting.value === 'day' ? 'day' : 'auto',
    };
    persist();
    redrawAppearance();
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
    unsubscribeGhost();
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
