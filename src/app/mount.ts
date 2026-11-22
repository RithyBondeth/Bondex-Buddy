import { FOCUS_MS, SpiritEngine, formatCountdown } from '../engine/spirit';
import type { Mood } from '../engine/spirit';
import { awardCompletions, canEquip, canWear } from '../engine/progress';
import { creditTask, dueReminders, type FocusTask } from '../engine/tasks';
import { openProgressStore } from '../platform/progress-store';
import { Ambience } from '../audio/ambience';
import { AnimationClock } from '../rendering/animation-clock';
import {
  observeActivity,
  observePlay,
  setPlayContext,
  setPlayfulRoaming,
  observeHover,
  observeAgentHover,
  observeFocus,
  observeVisibility,
  isDesktop,
  revealHabitat,
  setHabitatFocused,
  beginDrag,
  holdPetPointer,
  nudgeHabitat,
  setGhostMode,
  setWorking,
  observeGhost,
  updateHitMask,
  openBuddyPanel,
  setCompanionOpen,
  observeBuddyOpen,
} from '../platform/desktop';
import {
  createCompanionPocket,
  type PocketTab,
  type PocketView,
} from '../buddy/companion';
import { readAgents } from '../buddy/api';
import type { AgentSession, AgentSnapshot } from '../buddy/model';
import { createPetAgentThought } from '../buddy/pet-agent';
import {
  observeHabitatSettings,
  publishHabitatSettings,
} from '../platform/settings';
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
  pet.setAttribute('aria-label', 'Ember fox · open your thought');
  pet.setAttribute('aria-expanded', 'false');
  pet.setAttribute('aria-controls', 'ember-pocket');
  pet.title = 'Click Ember to open a thought. Right-click for clipboard.';
  pet.setAttribute(
    'aria-description',
    'Drag Ember or use the arrow keys to move. Right-click or press U for clipboard.',
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
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'session-toggle';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.setAttribute('aria-label', 'Reset session without completion');
  const persist = async () => {
    reportSettings();
    try {
      await store.save(progress);
      saveProblem = false;
    } catch {
      saveProblem = true;
    }
    reportSettings();
    return !saveProblem;
  };
  const moodLabel = document.createElement('p');
  moodLabel.className = 'mood-label';
  const agentThought = createPetAgentThought();
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
    moodLabel,
    agentThought.label,
    agentThought.pair,
    announcement,
  );
  root.replaceChildren(habitat);

  let companionOpen = false;
  let pocketBusy = false;
  let focusTask: string | null = null;
  let nextReminder: FocusTask | undefined;
  let soundedReminder = '';
  let latestSnapshot: AgentSnapshot | null = null;
  let handoff: AgentSession | undefined;
  const dismissedHandoffs = new Set<string>();
  const handoffKey = (item: AgentSession) =>
    `${item.agent}:${item.session}:${item.updatedAt}`;
  const pocket = createCompanionPocket(() => void changePocket(false), {
    toggle,
    reset,
    tasks: {
      save(items: FocusTask[]) {
        progress = { ...progress, tasks: items };
        render();
        return persist();
      },
      start(id: string) {
        const now = Date.now();
        render();
        if (
          engine.read(now).timer ||
          !progress.tasks.some((task) => task.id === id && !task.done)
        )
          return false;
        focusTask = id;
        engine.toggleTimer(now);
        render();
        return true;
      },
    },
    dismissHandoff(item) {
      dismissedHandoffs.add(handoffKey(item));
      showAgentSignals(latestSnapshot);
      render();
    },
  });
  habitat.append(pocket.sheet);
  async function changePocket(
    open: boolean,
    tab: PocketTab = 'focus',
    view?: PocketView,
  ) {
    if (pocketBusy) return;
    if (open && companionOpen) {
      pocket.setOpen(true, tab, view);
      return;
    }
    if (!open && !companionOpen) return;
    pocketBusy = true;
    try {
      if (!open) {
        habitat.classList.remove('companion-open');
        pocket.sheet.inert = true;
        if (!motion.matches) {
          // Keep the native window expanded until the thought has faded out.
          const effects = pocket.sheet.getAnimations();
          await Promise.allSettled(effects.map((effect) => effect.finished));
        }
      }
      await setCompanionOpen(open);
      document.documentElement.classList.toggle('pocket-expanded', open);
      companionOpen = open;
      habitat.classList.toggle('companion-open', open);
      pocket.setOpen(open, tab, view);
      pet.setAttribute('aria-expanded', String(open));
      render();
    } catch (error) {
      habitat.classList.toggle('companion-open', companionOpen);
      pocket.sheet.inert = !companionOpen;
      moodLabel.textContent = 'The thought could not open. Try again.';
      console.error('Pocket update failed:', error);
    } finally {
      pocketBusy = false;
      if (!companionOpen) pet.focus({ preventScroll: true });
    }
  }
  const unsubscribePocket = await observeBuddyOpen((tab) => {
    if (tab === 'close') {
      void changePocket(false);
      return;
    }
    if (['focus', 'clipboard', 'agents'].includes(tab))
      void changePocket(
        true,
        tab as PocketTab,
        tab === 'focus' && nextReminder ? 'reminder' : undefined,
      );
  });

  const renderer = await createHabitatRenderer(canvas);
  let press: { x: number; y: number } | undefined;
  let dragged = false;
  pet.addEventListener('pointerdown', (event) => {
    dragged = false;
    if (!isDesktop() || event.button !== 0) return;
    press = { x: event.screenX, y: event.screenY };
    pet.setPointerCapture(event.pointerId);
    void holdPetPointer().catch(console.error);
  });
  const endPress = () => {
    press = undefined;
  };
  pet.addEventListener('pointerup', endPress);
  pet.addEventListener('pointercancel', endPress);
  pet.addEventListener('lostpointercapture', endPress);
  pet.addEventListener('pointermove', (event) => {
    if (
      press &&
      Math.hypot(event.screenX - press.x, event.screenY - press.y) >= 4
    ) {
      endPress();
      dragged = true;
      void beginDrag().catch(console.error);
      return;
    }
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
  let habitatFocused = false;
  let lastMood: Mood | undefined;
  let lastAppearance = '';
  let wasWorking: boolean | undefined;
  let moodStartedAt = performance.now();
  let lastMask: number[] | undefined;
  let completed = 0;
  let habitatVisible = false;
  let lastAnnouncement = '';
  let greetingEnd: ReturnType<typeof setTimeout> | undefined;
  let agent: AgentSession | null = null;
  let agentCue: AgentSession['status'] = 'idle';
  let agentAnnouncement = '';
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
  const updateAttention = () => {
    const focused =
      (isDesktop() ? windowFocused : document.hasFocus()) &&
      habitat.matches(':focus-within');
    habitat.classList.toggle('show-thought', hovering || focused);
    if (focused !== habitatFocused) {
      habitatFocused = focused;
      enqueue(() => setHabitatFocused(focused));
    }
  };
  habitat.addEventListener('pointerenter', () => {
    if (isDesktop()) return;
    hovering = true;
    updateAttention();
  });
  habitat.addEventListener('pointerleave', () => {
    if (isDesktop()) return;
    hovering = false;
    updateAttention();
  });
  habitat.addEventListener('focusin', updateAttention);
  habitat.addEventListener('focusout', () => queueMicrotask(updateAttention));
  window.addEventListener('focus', updateAttention);
  window.addEventListener('blur', updateAttention);

  const render = (initial = false): number[] | undefined => {
    const now = Date.now();
    const date = new Date(now);
    const snapshot = engine.read(now, date.getHours() * 60 + date.getMinutes());
    const due = dueReminders(progress.tasks, now);
    const working = snapshot.mood === 'Working';
    quietPlay =
      companionOpen ||
      due.length > 0 ||
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
      const earned = snapshot.completedFocusSessions - completed;
      progress = {
        ...awardCompletions(progress, earned),
        tasks: creditTask(progress.tasks, focusTask, earned),
      };
      void persist();
    }
    completed = snapshot.completedFocusSessions;
    const timer = snapshot.timer;
    if (timer?.phase !== 'Focus') focusTask = null;
    const task = progress.tasks.find((item) => item.id === focusTask);
    const label = timer
      ? timer.status === 'paused'
        ? 'Resume'
        : 'Pause'
      : 'Start';
    toggle.textContent = label;
    toggle.setAttribute(
      'aria-label',
      `${label} ${timer?.phase.toLowerCase() ?? 'focus'} session`,
    );
    toggle.title = timer
      ? `${timer.phase} ${timer.status}`
      : 'Start a 25-minute focus session';
    reset.disabled = !timer;
    habitat.dataset.mood = snapshot.mood;
    const duration = timer?.phase === 'Break' ? 5 * 60_000 : FOCUS_MS;
    pocket.update(
      formatCountdown(timer?.remainingMs ?? FOCUS_MS),
      timer
        ? `${timer.phase === 'Break' ? 'A well-earned break' : 'Focus time'}${timer.status === 'paused' ? ' · paused' : ''}`
        : 'Ready when you are',
      Math.max(0, Math.min(1, 1 - (timer?.remainingMs ?? duration) / duration)),
      timer?.status ?? 'ready',
      task,
    );
    nextReminder = due[0];
    const reminderSignal = nextReminder
      ? `${nextReminder.id}:${nextReminder.remindAt}`
      : '';
    if (
      habitatVisible &&
      reminderSignal &&
      reminderSignal !== soundedReminder
    ) {
      audio.chime();
      soundedReminder = reminderSignal;
    }
    habitat.classList.toggle('has-task-reminder', !!nextReminder);
    pocket.setTasks(
      progress.tasks,
      focusTask,
      timer === null,
      store.readOnly,
      due,
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
    moodLabel.textContent = nextReminder
      ? `Reminder · ${nextReminder.title}`
      : play.roaming
        ? playLabels[play.action]
        : `${snapshot.mood}${timer?.status === 'paused' ? ' · paused' : ''}`;
    moodLabel.title = snapshot.activityAvailable
      ? 'System idle time is available; no input content is collected.'
      : 'System activity unavailable. Manual focus sessions still work.';
    const thought = nextReminder
      ? `Reminder for ${nextReminder.title}`
      : agentAnnouncement ||
        (play.roaming ? 'Ember is playing' : snapshot.mood);
    const message = `${thought}. ${timer ? `${timer.phase} ${timer.status}.` : 'No focus session running.'}`;
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
  const reportSettings = (error: string | null = null) => {
    const { version, outfit, ghost, completedFocusSessions, decor, lighting } =
      progress;
    const snapshot = {
      progress: {
        version,
        outfit,
        ghost,
        completedFocusSessions,
        decor,
        lighting,
      },
      saveProblem,
      roaming: play.enabled,
      sound: audio.enabled,
      error,
    };
    enqueue(() => publishHabitatSettings(snapshot));
  };
  const unsubscribePlay = await observePlay((snapshot) => {
    const changed = play.enabled !== snapshot.enabled;
    play = snapshot;
    playReceivedAt = performance.now();
    playStartedAt = playReceivedAt - snapshot.elapsedMs;
    habitat.classList.toggle('free-roam', snapshot.roaming);
    if (changed) reportSettings();
  });
  const unsubscribeFocus = await observeFocus((focused) => {
    windowFocused = focused;
    updateAttention();
  });
  const unsubscribeHover = await observeHover((inside) => {
    if (!inside) renderer.setAttention(null);
    hovering = inside;
    updateAttention();
  });
  const unsubscribeAgentHover = await observeAgentHover((inside) =>
    agentThought.pair.classList.toggle('is-hovered', inside),
  );
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
    unsubscribeAgentHover();
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
  pet.addEventListener('click', (event) => {
    if (dragged && event.detail > 0) return;
    if (engine.interact(Date.now())) {
      moodStartedAt = performance.now();
      clearTimeout(greetingEnd);
      greetingEnd = setTimeout(render, 2000);
      audio.chime();
    }
    render();
    const liveAgent =
      agentCue === 'working' ||
      agentCue === 'needsInput' ||
      agentCue === 'error';
    const view = nextReminder ? 'reminder' : handoff ? 'handoffs' : undefined;
    const tab = nextReminder
      ? 'focus'
      : handoff || liveAgent
        ? 'agents'
        : 'focus';
    void changePocket(!companionOpen, tab, view);
  });
  toggle.addEventListener('click', () => {
    engine.toggleTimer(Date.now());
    render();
  });
  reset.addEventListener('click', () => {
    engine.resetTimer(Date.now());
    render();
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
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !isDesktop()) return;
    event.preventDefault();
    void beginDrag().catch(console.error);
  });
  const moveWithArrows = (event: KeyboardEvent) => {
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
  };
  pet.addEventListener('keydown', moveWithArrows);
  handle.addEventListener('keydown', moveWithArrows);
  let settingsUpdates = Promise.resolve();
  const unsubscribeSettings = await observeHabitatSettings((change) => {
    settingsUpdates = settingsUpdates
      .then(async () => {
        if (disposed) return;
        switch (change.setting) {
          case 'sound':
            await audio.setEnabled(change.value);
            break;
          case 'roaming':
            await setPlayfulRoaming(change.value);
            play = { ...play, enabled: change.value };
            break;
          case 'ghost':
            await setGhostMode(change.value);
            progress = { ...progress, ghost: change.value };
            persist();
            return;
          case 'decor':
            if (!canEquip(progress, change.value))
              throw new Error(
                'Complete more focus sessions to unlock this decor.',
              );
            progress = { ...progress, decor: change.value };
            persist();
            redrawAppearance();
            return;
          case 'outfit':
            if (!canWear(progress, change.value))
              throw new Error(
                'Complete more focus sessions to unlock this outfit.',
              );
            progress = { ...progress, outfit: change.value };
            persist();
            redrawAppearance();
            return;
          case 'lighting':
            progress = { ...progress, lighting: change.value };
            persist();
            redrawAppearance();
            return;
        }
        reportSettings();
      })
      .catch((error: unknown) =>
        reportSettings(error instanceof Error ? error.message : String(error)),
      );
  });
  reportSettings();
  const interval = setInterval(render, 1000);
  function showAgentSignals(snapshot: AgentSnapshot | null) {
    latestSnapshot = snapshot;
    const signals = snapshot?.handoffs ?? [];
    const currentKeys = new Set(signals.map(handoffKey));
    for (const key of dismissedHandoffs)
      if (!currentKeys.has(key)) dismissedHandoffs.delete(key);
    const handoffs = signals.filter(
      (item) => !dismissedHandoffs.has(handoffKey(item)),
    );
    handoff = handoffs[0];
    const visible = snapshot ? { ...snapshot, handoffs } : null;
    habitat.classList.toggle('has-agent-handoff', !!handoff);
    agentAnnouncement = agentThought.update(visible);
    pocket.setAgents(visible);
  }
  const updateAgentCue = async () => {
    if (disposed || cueReadPending) return;
    cueReadPending = true;
    try {
      const snapshot = await readAgents();
      if (disposed) return;
      const next = snapshot.cue?.status ?? 'idle';
      if (
        next === 'done' &&
        (agentCue !== 'done' || snapshot.cue?.session !== agent?.session) &&
        engine.interact(Date.now())
      ) {
        moodStartedAt = performance.now();
        clearTimeout(greetingEnd);
        greetingEnd = setTimeout(render, 2000);
      }
      agent = snapshot.cue;
      agentCue = next;
      habitat.dataset.agent = next;
      showAgentSignals(snapshot);
      render();
    } catch {
      if (disposed) return;
      agent = null;
      agentCue = 'idle';
      habitat.dataset.agent = 'idle';
      showAgentSignals(null);
      render();
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
    unsubscribeSettings();
    pocket.dispose();
    unsubscribeFocus();
    unsubscribeHover();
    unsubscribeAgentHover();
    unsubscribeGhost();
    unsubscribeActivity();
    unsubscribeVisibility();
    motion.removeEventListener('change', syncMotion);
    animation.dispose();
    audio.dispose();
    window.removeEventListener('focus', updateAttention);
    window.removeEventListener('blur', updateAttention);
    window.removeEventListener('beforeunload', dispose);
  };
  window.addEventListener('beforeunload', dispose);
  return dispose;
}
