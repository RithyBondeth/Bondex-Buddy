import { FOCUS_MS, SpiritEngine, formatCountdown } from '../engine/spirit';
import type { Mood } from '../engine/spirit';
import { awardCompletions, canEquip, canWear } from '../engine/progress';
import type { Decor, Outfit } from '../engine/progress';
import { openProgressStore } from '../platform/progress-store';
import { Ambience } from '../audio/ambience';
import { AnimationClock } from '../rendering/animation-clock';
import {
  observeActivity,
  observePlay,
  setPlayContext,
  setPlayfulRoaming,
  observeHover,
  observeFocus,
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
  openBuddyPanel,
  readAgentCue,
  setCompanionOpen,
  observeBuddyOpen,
} from '../platform/desktop';
import { createCompanionPocket, type PocketTab } from '../buddy/companion';
import { icon } from '../buddy/icons';
import { createHabitatRenderer } from '../rendering/habitat';
import { restingPlay } from '../rendering/playful';

export async function mountApp(root: HTMLElement): Promise<() => void> {
  document.documentElement.classList.toggle('browser-preview', !isDesktop());
  document.documentElement.classList.remove('pocket-expanded');
  await setCompanionOpen(false);
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
  pet.setAttribute('aria-label', 'Ember fox · open your tools');
  pet.setAttribute('aria-expanded', 'false');
  pet.setAttribute('aria-controls', 'ember-pocket');
  pet.title = 'Click Ember to open your pocket. Right-click for clipboard.';
  pet.setAttribute(
    'aria-description',
    'Right-click or press U to open clipboard and AI agents.',
  );
  pet.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    void openBuddyPanel().catch(console.error);
  });
  pet.addEventListener('keydown', (event) => {
    if (
      event.key.toLowerCase() === 'u' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      void openBuddyPanel().catch(console.error);
    }
  });
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
  toggle.className = 'session-toggle';
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
  items.textContent = 'Style';
  items.setAttribute('aria-expanded', 'false');
  items.setAttribute('aria-label', 'Open decor and lighting');
  controls.append(items);
  const drawer = document.createElement('div');
  drawer.className = 'items-drawer';
  drawer.id = 'habitat-style';
  items.setAttribute('aria-controls', drawer.id);
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
  const playToggle = document.createElement('button');
  playToggle.type = 'button';
  playToggle.className = 'play-toggle';
  playToggle.textContent = 'Playful roaming on';
  playToggle.disabled = !isDesktop();
  playToggle.title =
    'Run, pounce, and peek behind the Dock. Pause by approaching Ember.';
  drawer.append(outfit, ghost, playToggle);
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
  const sessionProgress = document.createElement('div');
  sessionProgress.className = 'session-progress';
  sessionProgress.setAttribute('aria-hidden', 'true');
  const progressFill = document.createElement('div');
  sessionProgress.append(progressFill);
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
  habitat.append(
    pet,
    handle,
    controls,
    drawer,
    moodLabel,
    sessionProgress,
    announcement,
  );
  root.replaceChildren(habitat);

  let companionOpen = false;
  let pocketBusy = false;
  const pocketToggle = document.createElement('button');
  pocketToggle.type = 'button';
  pocketToggle.className = 'pocket-toggle';
  pocketToggle.append(icon('pocket'), document.createTextNode('Tools'));
  pocketToggle.setAttribute('aria-label', 'Open Ember’s pocket');
  pocketToggle.setAttribute('aria-controls', 'ember-pocket');
  pocketToggle.setAttribute('aria-expanded', 'false');
  const pocket = createCompanionPocket(() => void changePocket(false), {
    toggle,
    reset,
    sound,
    drawer,
  });
  habitat.append(pocket.sheet, pocketToggle);
  async function changePocket(open: boolean, tab: PocketTab = 'focus') {
    if (pocketBusy) return;
    if (open && companionOpen) {
      pocket.select(tab);
      return;
    }
    if (!open && !companionOpen) return;
    pocketBusy = true;
    pocketToggle.disabled = true;
    try {
      if (!open) {
        habitat.classList.remove('companion-open');
        pocket.sheet.inert = true;
        if (!motion.matches)
          await new Promise((resolve) => setTimeout(resolve, 220));
      }
      await setCompanionOpen(open);
      document.documentElement.classList.toggle('pocket-expanded', open);
      companionOpen = open;
      habitat.classList.toggle('companion-open', open);
      pocket.setOpen(open, tab);
      pocketToggle.setAttribute('aria-expanded', String(open));
      pet.setAttribute('aria-expanded', String(open));
      pocketToggle.setAttribute(
        'aria-label',
        open ? 'Close Ember’s pocket' : 'Open Ember’s pocket',
      );
      syncDrawer();
      render();
    } catch (error) {
      habitat.classList.toggle('companion-open', companionOpen);
      pocket.sheet.inert = !companionOpen;
      moodLabel.textContent = 'Pocket could not open. Try again.';
      console.error('Pocket update failed:', error);
    } finally {
      pocketBusy = false;
      pocketToggle.disabled = false;
      if (!companionOpen) pocketToggle.focus({ preventScroll: true });
    }
  }
  pocketToggle.addEventListener(
    'click',
    () => void changePocket(!companionOpen),
  );
  const unsubscribePocket = await observeBuddyOpen((tab) => {
    if (tab === 'close') {
      void changePocket(false);
      return;
    }
    if (['focus', 'clipboard', 'agents', 'style'].includes(tab))
      void changePocket(true, tab as PocketTab);
  });

  const renderer = await createHabitatRenderer(canvas);
  pet.addEventListener('pointermove', (event) => {
    const bounds = pet.getBoundingClientRect();
    renderer.setAttention(
      ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
    );
  });
  pet.addEventListener('pointerleave', () => renderer.setAttention(null));
  let play = restingPlay();
  let playStartedAt = performance.now();
  let playReceivedAt = performance.now();
  let quietPlay = true;
  let lastPlayContext = '';
  let disposed = false;
  let hovering = false;
  let windowFocused = false;
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
  let greetingEnd: ReturnType<typeof setTimeout> | undefined;
  let agentCue = 'idle';
  let cueReadPending = false;
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
      hovering ||
      ((isDesktop() ? windowFocused : document.hasFocus()) &&
        habitat.matches(':focus-within'));
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
    const next = companionOpen || (drawerOpen && visible);
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
    quietPlay =
      companionOpen ||
      agentCue === 'needsInput' ||
      agentCue === 'working' ||
      snapshot.mood === 'Happy' ||
      (snapshot.timer?.phase === 'Focus' &&
        snapshot.timer.status === 'running');
    const playContext = `${quietPlay}:${motion.matches}`;
    if (lastPlayContext !== playContext) {
      lastPlayContext = playContext;
      enqueue(() => setPlayContext(quietPlay, motion.matches));
    }
    if (wasWorking !== working) {
      wasWorking = working;
      enqueue(() => setWorking(working));
    }
    const displayMood: Mood =
      snapshot.timer?.status === 'running'
        ? snapshot.mood
        : agentCue === 'working'
          ? 'Working'
          : agentCue === 'needsInput'
            ? 'Idle'
            : snapshot.mood;
    let mask: number[] | undefined;
    const appearanceKey = JSON.stringify({
      ...appearance(),
      play: { ...play, elapsedMs: 0 },
    });
    if (lastMood !== displayMood || lastAppearance !== appearanceKey) {
      if (lastMood !== displayMood) moodStartedAt = performance.now();
      lastAppearance = appearanceKey;
      mask = renderer.draw(
        displayMood,
        performance.now() - moodStartedAt,
        motion.matches,
        appearance(),
      );
      lastMask = mask;
      if (!initial) enqueue(() => updateHitMask(mask!));
      lastMood = displayMood;
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
    habitat.dataset.mood = snapshot.mood;
    habitat.dataset.session = timer?.status ?? 'idle';
    sessionProgress.hidden = !timer;
    const duration = timer?.phase === 'Break' ? 5 * 60_000 : FOCUS_MS;
    progressFill.style.transform = `scaleX(${Math.max(0, Math.min(1, 1 - (timer?.remainingMs ?? duration) / duration))})`;
    pocket.update(
      formatCountdown(timer?.remainingMs ?? FOCUS_MS),
      timer
        ? `${timer.phase === 'Break' ? 'A well-earned break' : 'Focus time'}${timer.status === 'paused' ? ' · paused' : ''}`
        : 'Ready when you are',
      Math.max(0, Math.min(1, 1 - (timer?.remainingMs ?? duration) / duration)),
    );
    toggle.setAttribute('aria-pressed', String(timer?.status === 'running'));
    const playLabels = {
      rest: 'Taking a breather',
      walk: 'Sneaking closer',
      run: 'Feeling speedy',
      pounce: 'Feeling playful',
      hide: 'Hide and seek',
      peek: 'Peekaboo',
    };
    const cueLabels: Record<string, string> = {
      working: 'An agent is working',
      needsInput: 'An agent needs you · right-click',
      done: 'An agent is ready',
      error: 'An agent needs attention',
    };
    moodLabel.textContent =
      agentCue !== 'idle' && cueLabels[agentCue]
        ? cueLabels[agentCue]
        : play.roaming
          ? playLabels[play.action]
          : `${snapshot.mood}${timer?.status === 'paused' ? ' · paused' : ''}`;
    moodLabel.title = snapshot.activityAvailable
      ? 'System idle time is available; no input content is collected.'
      : 'System activity unavailable. Manual focus sessions still work.';
    const message = `${cueLabels[agentCue] ?? (play.roaming ? 'Ember is playing' : snapshot.mood)}. ${timer ? `${timer.phase} ${timer.status}.` : 'No focus session running.'}`;
    if (message !== lastAnnouncement) {
      announcement.textContent = message;
      lastAnnouncement = message;
    }
    return mask;
  };
  const appearance = () => {
    const hour = new Date().getHours();
    return {
      play: {
        ...play,
        elapsedMs: Math.max(0, performance.now() - playStartedAt),
        gaitMs:
          play.gaitMs === undefined
            ? undefined
            : play.gaitMs +
              (performance.now() - playReceivedAt) * (play.gaitRate ?? 0),
      },
      outfit: progress.outfit,
      decor: progress.decor,
      night: progress.lighting === 'auto' && (hour >= 18 || hour < 6),
    };
  };
  const unsubscribePlay = await observePlay((snapshot) => {
    play = snapshot;
    playReceivedAt = performance.now();
    playStartedAt = playReceivedAt - snapshot.elapsedMs;
    habitat.classList.toggle('free-roam', snapshot.roaming);
    playToggle.textContent = snapshot.enabled
      ? 'Roaming on · rest here'
      : 'Play now · run and peek';
    playToggle.setAttribute('aria-pressed', String(snapshot.enabled));
  });
  playToggle.addEventListener('click', () => {
    const enabled = !play.enabled;
    enqueue(() => setPlayfulRoaming(enabled));
    if (enabled) {
      drawerOpen = false;
      syncDrawer();
      playToggle.blur();
      if (companionOpen) void changePocket(false);
    }
  });
  const unsubscribeFocus = await observeFocus((focused) => {
    windowFocused = focused;
    updateControls();
  });
  const unsubscribeHover = await observeHover((inside) => {
    if (!inside) renderer.setAttention(null);
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
    unsubscribePlay();
    unsubscribeFocus();
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
  const syncMotion = () => {
    animation.setState(habitatVisible, motion.matches);
    enqueue(() => setPlayContext(quietPlay, motion.matches));
  };
  motion.addEventListener('change', syncMotion);
  const unsubscribeVisibility = await observeVisibility((visible) => {
    habitatVisible = visible;
    audio.setVisible(visible);
    syncMotion();
  });
  pet.addEventListener('click', () => {
    if (engine.interact(Date.now())) {
      moodStartedAt = performance.now();
      clearTimeout(greetingEnd);
      greetingEnd = setTimeout(render, 2000);
      audio.chime();
    }
    render();
    void changePocket(!companionOpen);
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
    void changePocket(true, 'style');
  });
  habitat.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawerOpen) {
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
  const updateAgentCue = async () => {
    if (disposed || cueReadPending) return;
    cueReadPending = true;
    try {
      const next = await readAgentCue();
      if (disposed) return;
      if (
        next === 'done' &&
        agentCue !== 'done' &&
        engine.interact(Date.now())
      ) {
        moodStartedAt = performance.now();
        clearTimeout(greetingEnd);
        greetingEnd = setTimeout(render, 2000);
      }
      agentCue = next;
      habitat.dataset.agent = next;
      render();
    } catch {
      agentCue = 'idle';
    } finally {
      cueReadPending = false;
    }
  };
  void updateAgentCue();
  const agentInterval = setInterval(() => void updateAgentCue(), 2500);
  const dispose = () => {
    disposed = true;
    clearInterval(interval);
    clearInterval(agentInterval);
    clearTimeout(greetingEnd);
    unsubscribePlay();
    unsubscribePocket();
    pocket.dispose();
    unsubscribeFocus();
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
