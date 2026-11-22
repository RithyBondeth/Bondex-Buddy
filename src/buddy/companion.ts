import { clipboardView } from './clipboard-view';
import { agentsView } from './agents-view';
import { button, element, errorMessage } from './dom';
import { icon } from './icons';
import './panel.css';
import './companion.css';

export type PocketTab = 'focus' | 'clipboard' | 'agents';

export function createCompanionPocket(
  close: () => void,
  controls: {
    toggle: HTMLButtonElement;
    reset: HTMLButtonElement;
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
  const clipboard = clipboardView(announce);
  const agents = agentsView();
  const focus = element('section', 'pocket-focus');
  focus.id = 'focus-panel';
  focus.setAttribute('role', 'tabpanel');
  focus.setAttribute('aria-labelledby', 'focus-tab');
  const clock = element('div', 'focus-clock', '25:00');
  const phase = element('p', 'focus-phase', 'Ready when you are');
  const readout = element('div', 'focus-readout');
  readout.append(clock, phase);
  const track = element('div', 'focus-track');
  const fill = element('div');
  track.setAttribute('aria-hidden', 'true');
  track.append(fill);
  const focusActions = element('div', 'focus-actions');
  focus.append(readout, track, focusActions);
  const body = element('div', 'pocket-body');
  const sections = {
    focus,
    clipboard: clipboard.section,
    agents: agents.section,
  };
  body.append(...Object.values(sections));
  sheet.append(bar, body);
  body.prepend(notice);
  focusActions.append(controls.toggle, controls.reset);
  const buttons = new Map<PocketTab, HTMLButtonElement>();
  let active: PocketTab = 'focus';
  let opened = false;
  let loading = false;
  let disposed = false;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const select = (tab: PocketTab) => {
    const changed = active !== tab;
    active = tab;
    for (const [name, section] of Object.entries(sections))
      section.hidden = name !== tab;
    for (const [name, control] of buttons) {
      control.setAttribute('aria-selected', String(name === tab));
      control.tabIndex = name === tab ? 0 : -1;
    }
    if (changed) {
      notice.hidden = true;
      body.scrollTop = 0;
      if (opened && !reduced())
        sections[tab].animate(
          [
            { opacity: 0, transform: 'translateY(6px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)' },
        );
    }
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
    if (loading || !opened || disposed || document.hidden) return;
    loading = true;
    try {
      if (active === 'clipboard') await clipboard.refresh();
      if (active === 'agents') await agents.refresh();
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
    select,
    setOpen(value: boolean, tab: PocketTab = active) {
      opened = value;
      sheet.inert = !value;
      if (value) {
        select(tab);
        requestAnimationFrame(() => {
          if (opened && !disposed)
            buttons.get(tab)?.focus({ preventScroll: true });
        });
      }
    },
    update(time: string, status: string, progress: number) {
      clock.textContent = time;
      phase.textContent = status;
      fill.style.transform = `scaleX(${progress})`;
    },
    dispose() {
      disposed = true;
      clearInterval(interval);
      clipboard.dispose();
    },
  };
}
