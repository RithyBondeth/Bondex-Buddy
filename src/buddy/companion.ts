import { clipboardView } from './clipboard-view';
import { agentsView } from './agents-view';
import { button, element, errorMessage } from './dom';
import { icon } from './icons';
import type { AgentSession, AgentSnapshot } from './model';
import type { FocusTask } from '../engine/tasks';
import type { TimerPhase } from '../engine/spirit';
import type { WaterAction } from '../engine/water';
import { companionNames, type CompanionId } from '../engine/companions';
import { companionArt } from '../rendering/companion-art';
import { tasksView, type TaskControls } from './tasks-view';
import { pouchView } from './pouch-view';
import { abilityNames } from '../../website/shared/abilities';
import '../../website/shared/pocket-themes.css';
import './panel.css';
import './companion.css';

export type PocketTab = 'focus' | 'clipboard' | 'files' | 'agents';
export type PocketView = 'reminder' | 'handoffs' | 'water';

const timerLabels = {
  ready: 'Ready',
  paused: 'Paused',
  running: 'In progress',
};

export function createCompanionPocket(
  close: () => void,
  controls: {
    toggle: HTMLButtonElement;
    reset: HTMLButtonElement;
    tasks: TaskControls;
    dismissHandoff(item: AgentSession): void;
    replayAbility(): void;
    water(action: WaterAction): void;
  },
) {
  const sheet = element('section', 'buddy-surface companion-sheet');
  sheet.id = 'ember-pocket';
  sheet.inert = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-labelledby', 'pocket-title');
  const bar = element('header', 'pocket-bar');
  const titlebar = element('div', 'pocket-titlebar');
  const portrait = element('img', 'pocket-portrait');
  portrait.alt = '';
  portrait.width = portrait.height = 24;
  const title = element('h2', 'pocket-title');
  title.id = 'pocket-title';
  const tabs = element('nav', 'pocket-tabs');
  tabs.setAttribute('role', 'tablist');
  const indicator = element('span', 'pocket-tab-indicator');
  indicator.setAttribute('aria-hidden', 'true');
  tabs.append(indicator);
  const closeButton = button('', 'pocket-close');
  closeButton.append(icon('close'));
  closeButton.addEventListener('click', close);
  titlebar.append(portrait, title, closeButton);
  bar.append(titlebar, tabs);
  const notice = element('p', 'panel-notice');
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  const announce = (text: string, error = false) => {
    notice.textContent = text;
    notice.classList.toggle('is-error', error);
    notice.hidden = false;
  };
  const clipboard = clipboardView(announce, (text) => tasks.addFromText(text));
  const pouch = pouchView(announce);
  const agents = agentsView(announce, controls.dismissHandoff);
  const focus = element('section', 'pocket-focus');
  focus.id = 'focus-panel';
  focus.setAttribute('role', 'tabpanel');
  focus.setAttribute('aria-labelledby', 'focus-tab');
  const timerView = element('div', 'focus-timer');
  const timerCard = element('div', 'focus-card');
  const clock = element('div', 'focus-clock', '25:00');
  const abilityButton = button('', 'pocket-ability');
  const playMark = element('span', '', '▶');
  playMark.setAttribute('aria-hidden', 'true');
  const abilityLabel = element('span');
  abilityButton.append(playMark, abilityLabel);
  abilityButton.addEventListener('click', controls.replayAbility);
  const clockRow = element('div', 'focus-clock-row');
  clockRow.append(clock, abilityButton);
  const phase = element('h2', 'focus-phase', 'Focus session');
  const status = element('span', 'focus-status', 'Ready');
  const readout = element('div', 'focus-readout');
  readout.append(phase, status);
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
  timerCard.append(readout, clockRow, track);
  timerView.append(timerCard, focusActions);
  focus.append(timerView, tasks.section, water);
  const body = element('div', 'pocket-body');
  const sections = {
    focus,
    clipboard: clipboard.section,
    files: pouch.section,
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
    if (tab === 'files') buttons.get('files')?.classList.remove('has-activity');
    void refresh();
  };
  for (const [tab, label] of Object.entries({
    focus: 'Focus',
    clipboard: 'Clipboard',
    files: 'Files',
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
      (active !== 'clipboard' && active !== 'files')
    )
      return;
    loading = true;
    try {
      if (active === 'files') await pouch.refresh();
      else await clipboard.refresh();
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
    setCompanion(id: CompanionId) {
      const name = companionNames[id];
      abilityLabel.textContent = abilityNames[id];
      abilityButton.setAttribute('aria-label', `Play ${abilityNames[id]}`);
      abilityButton.title = `Close the pocket and play ${abilityNames[id]}`;
      portrait.src = companionArt[id];
      title.textContent = `${name}’s pocket`;
      tabs.setAttribute('aria-label', `${name}’s tools`);
      closeButton.setAttribute('aria-label', `Close ${name}’s pocket`);
    },
    pouchChanged(added: number, error: string | null) {
      if (opened && active === 'files') {
        if (error) announce(error, true);
        else if (added)
          announce(`${added} ${added === 1 ? 'file' : 'files'} tucked away.`);
        void refresh();
      } else if (added) {
        buttons.get('files')?.classList.add('has-activity');
      }
    },
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
      timerPhase: TimerPhase,
      progress: number,
      state: 'ready' | 'paused' | 'running',
      task: FocusTask | undefined,
    ) {
      clock.textContent = time;
      const phaseLabel =
        timerPhase === 'Break' ? 'Break time' : 'Focus session';
      phase.textContent = task?.title ?? phaseLabel;
      phase.title = task ? `${phaseLabel} · ${task.title}` : '';
      status.textContent = timerLabels[state];
      focus.dataset.state = state;
      focus.dataset.phase = timerPhase.toLowerCase();
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
