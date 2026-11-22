import { clipboardView } from './clipboard-view';
import { agentsView } from './agents-view';
import { button, element, errorMessage } from './dom';
import { icon } from './icons';
import type { AgentSession, AgentSnapshot } from './model';
import type { FocusTask } from '../engine/tasks';
import type { WaterAction } from '../engine/water';
import { tasksView, type TaskControls } from './tasks-view';
import './panel.css';
import './companion.css';

export type PocketTab = 'focus' | 'clipboard' | 'agents';
export type PocketView = 'reminder' | 'handoffs' | 'water';

export function createCompanionPocket(
  close: () => void,
  controls: {
    toggle: HTMLButtonElement;
    reset: HTMLButtonElement;
    tasks: TaskControls;
    dismissHandoff(item: AgentSession): void;
    water(action: WaterAction): void;
  },
) {
  const sheet = element('section', 'buddy-surface companion-sheet');
  sheet.id = 'ember-pocket';
  sheet.inert = true;
  sheet.setAttribute('aria-label', 'Ember’s thought');
  const bar = element('header', 'pocket-bar');
  const tabs = element('nav', 'pocket-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Ember’s tools');
  const indicator = element('span', 'pocket-tab-indicator');
  indicator.setAttribute('aria-hidden', 'true');
  tabs.append(indicator);
  const closeButton = button('', 'pocket-close');
  closeButton.append(icon('close'));
  closeButton.setAttribute('aria-label', 'Close Ember’s thought');
  closeButton.addEventListener('click', close);
  bar.append(tabs, closeButton);
  const notice = element('p', 'panel-notice');
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  const announce = (text: string, error = false) => {
    notice.textContent = text;
    notice.classList.toggle('is-error', error);
    notice.hidden = false;
  };
  const clipboard = clipboardView(announce, (text) => tasks.addFromText(text));
  const agents = agentsView(announce, controls.dismissHandoff);
  const focus = element('section', 'pocket-focus');
  focus.id = 'focus-panel';
  focus.setAttribute('role', 'tabpanel');
  focus.setAttribute('aria-labelledby', 'focus-tab');
  const timerView = element('div', 'focus-timer');
  const clock = element('div', 'focus-clock', '25:00');
  const phase = element('p', 'focus-phase', 'Ready when you are');
  const readout = element('div', 'focus-readout');
  readout.append(clock, phase);
  const track = element('div', 'focus-track');
  const fill = element('div');
  track.setAttribute('aria-hidden', 'true');
  track.append(fill);
  const focusActions = element('div', 'focus-actions');
  const tasksButton = button('Tasks', 'focus-tasks-button');
  tasksButton.setAttribute('aria-controls', 'pocket-tasks');
  tasksButton.addEventListener('click', () => showTasks(true));
  const tasks = tasksView(controls.tasks, () => showTasks(false));
  const water = element('div', 'water-visit');
  water.hidden = true;
  const waterHeading = element('div', 'water-visit-heading');
  waterHeading.append(
    icon('water'),
    element('h2', '', 'Time for a water break'),
  );
  const waterActions = element('div', 'water-visit-actions');
  const drank = button('Drank water', 'task-button water-drank');
  const snooze = button('Snooze 10m', 'task-button');
  const skip = button('Skip', 'task-button');
  drank.addEventListener('click', () => controls.water('drank'));
  snooze.addEventListener('click', () => controls.water('snooze'));
  skip.addEventListener('click', () => controls.water('skip'));
  waterActions.append(drank, snooze, skip);
  water.append(waterHeading, waterActions);
  timerView.append(readout, track, focusActions);
  focus.append(timerView, tasks.section, water);
  const body = element('div', 'pocket-body');
  const sections = {
    focus,
    clipboard: clipboard.section,
    agents: agents.section,
  };
  body.append(...Object.values(sections));
  sheet.append(bar, body);
  body.prepend(notice);
  focusActions.append(controls.toggle, controls.reset, tasksButton);
  const buttons = new Map<PocketTab, HTMLButtonElement>();
  let active: PocketTab = 'focus';
  let opened = false;
  let loading = false;
  let disposed = false;
  let agentSnapshot: AgentSnapshot | null | undefined;

  function showTasks(show: boolean, showDue = false) {
    water.hidden = true;
    timerView.hidden = show;
    tasks.section.hidden = !show;
    body.scrollTop = 0;
    if (show) tasks.focus(showDue);
    else tasksButton.focus({ preventScroll: true });
  }

  function showWater() {
    timerView.hidden = true;
    tasks.section.hidden = true;
    water.hidden = false;
    body.scrollTop = 0;
    drank.focus({ preventScroll: true });
  }

  const select = (tab: PocketTab) => {
    const changed = active !== tab;
    active = tab;
    for (const [name, section] of Object.entries(sections))
      section.hidden = name !== tab;
    for (const [name, control] of buttons) {
      control.setAttribute('aria-selected', String(name === tab));
      control.tabIndex = name === tab ? 0 : -1;
    }
    tabs.style.setProperty(
      '--tab-offset',
      `${[...buttons.keys()].indexOf(tab) * 100}%`,
    );
    if (changed) {
      notice.hidden = true;
      body.scrollTop = 0;
    }
    if (tab === 'agents') agents.render(agentSnapshot);
    void refresh();
  };
  for (const [tab, label] of Object.entries({
    focus: 'Focus',
    clipboard: 'Clipboard',
    agents: 'Agents',
  })) {
    const control = button('', 'pocket-tab');
    control.id = `${tab}-tab`;
    control.setAttribute('role', 'tab');
    control.setAttribute('aria-controls', `${tab}-panel`);
    control.setAttribute('aria-label', label);
    control.title = label;
    control.append(
      icon(tab),
      element('span', '', tab === 'clipboard' ? 'Clips' : label),
    );
    control.addEventListener('click', () => select(tab as PocketTab));
    tabs.append(control);
    buttons.set(tab as PocketTab, control);
  }
  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const names = [...buttons.keys()];
    const next =
      event.key === 'Home'
        ? names[0]
        : event.key === 'End'
          ? names[names.length - 1]
          : names[
              (names.indexOf(active) +
                (event.key === 'ArrowRight' ? 1 : names.length - 1)) %
                names.length
            ];
    select(next);
    buttons.get(next)!.focus();
  });
  sheet.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      select('clipboard');
      clipboard.focus();
    }
  });
  async function refresh() {
    if (
      loading ||
      !opened ||
      disposed ||
      document.hidden ||
      active !== 'clipboard'
    )
      return;
    loading = true;
    try {
      await clipboard.refresh();
    } catch (error) {
      announce(errorMessage(error), true);
    } finally {
      loading = false;
    }
  }
  const interval = setInterval(() => void refresh(), 1200);
  select('focus');
  return {
    sheet,
    setOpen(value: boolean, tab: PocketTab = active, view?: PocketView) {
      opened = value;
      sheet.inert = !value;
      if (!value && !water.hidden) {
        water.hidden = true;
        timerView.hidden = false;
      }
      if (value) {
        select(tab);
        requestAnimationFrame(() => {
          if (!opened || disposed) return;
          if (view === 'reminder') showTasks(true, true);
          else if (view === 'handoffs') agents.showHandoffs();
          else if (view === 'water') showWater();
          else buttons.get(tab)?.focus({ preventScroll: true });
        });
      }
    },
    setWaterSnooze(enabled: boolean) {
      snooze.hidden = !enabled;
    },
    update(
      time: string,
      status: string,
      progress: number,
      state: 'ready' | 'paused' | 'running',
      task: FocusTask | undefined,
    ) {
      clock.textContent = time;
      phase.textContent = task?.title ?? status;
      phase.title = task ? `${status} · ${task.title}` : '';
      phase.classList.toggle('is-task', !!task);
      focus.dataset.state = state;
      fill.style.transform = `scaleX(${progress})`;
    },
    setTasks(
      items: FocusTask[],
      active: string | null,
      ready: boolean,
      locked: boolean,
      due: FocusTask[],
    ) {
      tasks.update(items, active, ready, locked, due);
      tasksButton.classList.toggle('has-reminder', due.length > 0);
    },
    setAgents(snapshot: AgentSnapshot | null) {
      agentSnapshot = snapshot;
      const live = snapshot?.sessions.some(
        ({ status }) => status === 'working' || status === 'needsInput',
      );
      buttons
        .get('agents')
        ?.classList.toggle(
          'has-activity',
          Boolean(live || snapshot?.handoffs?.length),
        );
      if (opened && active === 'agents') agents.render(snapshot);
    },
    dispose() {
      disposed = true;
      clearInterval(interval);
      clipboard.dispose();
    },
  };
}
