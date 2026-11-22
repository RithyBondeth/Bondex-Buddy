import { isTauri } from '@tauri-apps/api/core';
import { button, element, errorMessage } from '../buddy/dom';
import { habitatSettings } from './habitat';
import { integrationSettings } from './integrations';
import '../buddy/panel.css';
import './settings.css';

const root = document.querySelector<HTMLElement>('#settings');
if (!root) throw new Error('Settings root is missing');
const header = element('header', 'panel-header');
const identity = element('div', 'panel-brand');
const portrait = element('span', 'ember-portrait');
portrait.setAttribute('aria-hidden', 'true');
const title = element('div');
title.append(element('h1', '', 'Settings'), element('p', '', 'Bondex Buddy'));
identity.append(portrait, title);
header.append(identity);

const tabs = element('nav', 'panel-tabs');
tabs.setAttribute('role', 'tablist');
tabs.setAttribute('aria-label', 'Settings sections');
const notice = element('p', 'panel-notice');
notice.setAttribute('role', 'status');
notice.hidden = true;
const announce = (text: string, error = false) => {
  notice.textContent = text;
  notice.classList.toggle('is-error', error);
  notice.hidden = !text;
};

const habitat = habitatSettings(announce);
const integrations = integrationSettings(announce);
const panes = [habitat, integrations];
const body = element('main', 'settings-body');
let selected = 0;

const tabButtons = ['Ember', 'Clipboard & agents'].map((label, index) => {
  const pane = panes[index].section;
  const tab = button(label, 'panel-tab');
  tab.id = `settings-tab-${index}`;
  tab.setAttribute('role', 'tab');
  pane.id = `settings-pane-${index}`;
  pane.setAttribute('role', 'tabpanel');
  pane.setAttribute('aria-labelledby', tab.id);
  tab.setAttribute('aria-controls', pane.id);
  tab.addEventListener('click', () => select(index));
  tabs.append(tab);
  body.append(pane);
  return tab;
});

function refresh() {
  void panes[selected]
    .refresh()
    .catch((error: unknown) => announce(errorMessage(error), true));
}

function select(index: number) {
  selected = index;
  for (const [i, control] of tabButtons.entries()) {
    control.tabIndex = i === index ? 0 : -1;
    control.setAttribute('aria-selected', String(i === index));
    panes[i].section.hidden = i !== index;
  }
  announce('');
  window.scrollTo(0, 0);
  refresh();
}

tabs.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - selected;
  select(next);
  tabButtons[next].focus();
});

root.append(header, tabs);
if (!isTauri())
  root.append(element('p', 'settings-preview', 'Desktop settings preview'));
root.append(notice, body);
select(0);
window.addEventListener('focus', refresh);
const dispose = () => {
  habitat.dispose();
  window.removeEventListener('focus', refresh);
};
window.addEventListener('beforeunload', dispose, { once: true });
import.meta.hot?.dispose(dispose);
