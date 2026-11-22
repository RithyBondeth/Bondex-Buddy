import { listen } from '@tauri-apps/api/event';
import { agentsView } from './agents-view';
import { clipboardView } from './clipboard-view';
import { native } from './api';
import { button, element, errorMessage } from './dom';
import { icon } from './icons';
import './panel.css';

const root = document.querySelector<HTMLElement>('#buddy');
if (!root) throw new Error('Buddy panel root is missing');
root.classList.add('buddy-surface');
document.body.classList.add('buddy-page');

const header = element('header', 'panel-header');
const identity = element('div', 'panel-brand');
const portrait = element('div', 'ember-portrait');
portrait.setAttribute('aria-hidden', 'true');
const title = element('div');
title.append(
  element('h1', '', 'Ember'),
  element('p', '', 'Your little desktop buddy'),
);
identity.append(portrait, title);
const local = element(
  'span',
  'local-badge',
  native ? 'ON YOUR DEVICE' : 'BROWSER PREVIEW',
);
header.append(identity, local);
const tabs = element('nav', 'panel-tabs');
tabs.setAttribute('role', 'tablist');
tabs.setAttribute('aria-label', 'Buddy tools');
const clipTab = button('Clipboard', 'panel-tab');
clipTab.id = 'clipboard-tab';
clipTab.setAttribute('role', 'tab');
clipTab.setAttribute('aria-controls', 'clipboard-panel');
const agentTab = button('AI agents', 'panel-tab');
agentTab.id = 'agents-tab';
agentTab.setAttribute('role', 'tab');
agentTab.setAttribute('aria-controls', 'agents-panel');
tabs.append(clipTab, agentTab);
const notice = element('p', 'panel-notice');
notice.setAttribute('role', 'status');
notice.hidden = true;
const announce = (message: string, error = false) => {
  notice.textContent = message;
  notice.classList.toggle('is-error', error);
  notice.hidden = false;
};
const clipboard = clipboardView(announce);
const agents = agentsView();
const body = element('div', 'panel-body');
body.append(clipboard.section, agents.section);
const footer = element('footer', 'panel-footer');
const heart = icon('heart');
heart.classList.add('footer-paw');
footer.append(element('span', '', 'A calmer corner of your desktop.'), heart);
root.append(header, tabs, notice, body, footer);
if (!native)
  announce(
    'Preview only. Sample clips are optional; clipboard capture and agent setup run in the desktop app.',
  );

let active: 'clipboard' | 'agents' =
  new URLSearchParams(location.search).get('tab') === 'agents'
    ? 'agents'
    : 'clipboard';
let loading = false;
let disposed = false;
let unsubscribe: (() => void) | undefined;

async function refresh() {
  if (loading || disposed || document.hidden) return;
  loading = true;
  try {
    await (active === 'clipboard' ? clipboard.refresh() : agents.refresh());
  } catch (error) {
    announce(errorMessage(error), true);
  } finally {
    loading = false;
  }
}

function select(tab: 'clipboard' | 'agents') {
  active = tab;
  clipboard.section.hidden = tab !== 'clipboard';
  agents.section.hidden = tab !== 'agents';
  clipTab.setAttribute('aria-selected', String(tab === 'clipboard'));
  agentTab.setAttribute('aria-selected', String(tab === 'agents'));
  clipTab.tabIndex = tab === 'clipboard' ? 0 : -1;
  agentTab.tabIndex = tab === 'agents' ? 0 : -1;
  void refresh();
}
clipTab.addEventListener('click', () => select('clipboard'));
agentTab.addEventListener('click', () => select('agents'));
tabs.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 'clipboard'
      : event.key === 'End'
        ? 'agents'
        : active === 'clipboard'
          ? 'agents'
          : 'clipboard';
  select(next);
  (next === 'clipboard' ? clipTab : agentTab).focus();
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    select('clipboard');
    clipboard.focus();
  }
});
select(active);
if (native) {
  void listen<string>('buddy-tab', ({ payload }) => {
    if (payload === 'clipboard' || payload === 'agents') select(payload);
  })
    .then((cleanup) => {
      if (disposed) cleanup();
      else unsubscribe = cleanup;
    })
    .catch((error: unknown) => announce(errorMessage(error), true));
}
const interval = setInterval(() => void refresh(), 1200);
document.addEventListener('visibilitychange', refresh);
const dispose = () => {
  disposed = true;
  clearInterval(interval);
  clipboard.dispose();
  unsubscribe?.();
  document.removeEventListener('visibilitychange', refresh);
};
window.addEventListener('beforeunload', dispose, { once: true });
import.meta.hot?.dispose(dispose);
