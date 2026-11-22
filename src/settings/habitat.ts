import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { element, errorMessage, type Announce } from '../buddy/dom';
import { canEquip, canWear, freshProgress } from '../engine/progress';
import type { HabitatChange, HabitatSettings } from '../platform/settings';

export function settingRow(
  label: string,
  control: HTMLInputElement | HTMLSelectElement,
  help?: string,
) {
  const row = element('label', 'setting-row');
  const description = element('span', 'setting-description');
  description.append(element('span', '', label));
  if (help) description.append(element('small', '', help));
  row.append(description, control);
  return row;
}

export function settingSwitch() {
  const input = element('input', 'setting-switch');
  input.type = 'checkbox';
  input.disabled = true;
  return input;
}

function settingSelect(options: [string, string][]) {
  const select = element('select', 'setting-select');
  select.disabled = true;
  for (const [value, text] of options) select.add(new Option(text, value));
  return select;
}

export function settingsGroup(title: string) {
  const group = element('section', 'settings-group');
  group.append(element('h2', '', title));
  return group;
}

export function habitatSettings(announce: Announce) {
  const section = element('div', 'settings-pane');
  const appearance = settingsGroup('Appearance');
  const decor = settingSelect([
    ['none', 'Bare desk'],
    ['plant', 'Plant · 1 focus'],
    ['lantern', 'Lantern · 3 focus'],
  ]);
  const outfit = settingSelect([
    ['none', 'No outfit'],
    ['beanie', 'Beanie · 2 focus'],
    ['scarf', 'Scarf · 5 focus'],
  ]);
  const lighting = settingSelect([
    ['auto', 'Time of day'],
    ['day', 'Daylight'],
  ]);
  const progressNote = element('p', 'settings-note');
  appearance.append(
    settingRow('Desk decor', decor),
    settingRow('Outfit', outfit),
    settingRow('Lighting', lighting),
    progressNote,
  );

  const behavior = settingsGroup('Behavior');
  const roam = settingSwitch();
  const ghost = settingSwitch();
  const sound = settingSwitch();
  behavior.append(
    settingRow('Playful roaming', roam, 'Let Ember explore the desktop.'),
    settingRow('Ghost Mode', ghost, 'During work, clicks pass through Ember.'),
    settingRow('Sound', sound, 'Quiet rain ambience and gentle chimes.'),
  );
  const startup = settingsGroup('Startup');
  const login = settingSwitch();
  const loginRow = settingRow(
    'Launch at login',
    login,
    'Start Bondex Buddy when you sign in.',
  );
  const loginHint = loginRow.querySelector('small')!;
  if (!isTauri()) loginHint.textContent = 'Desktop app only.';
  startup.append(loginRow);
  section.append(appearance, behavior, startup);

  const controls = [decor, outfit, lighting, roam, ghost, sound];
  let latest: HabitatSettings | null = null;
  let revision = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function render(snapshot: HabitatSettings) {
    revision++;
    latest = snapshot;
    clearTimeout(pending);
    for (const control of controls) control.disabled = false;
    for (const option of decor.options)
      option.disabled = !canEquip(
        snapshot.progress,
        option.value as HabitatSettings['progress']['decor'],
      );
    for (const option of outfit.options)
      option.disabled = !canWear(
        snapshot.progress,
        option.value as HabitatSettings['progress']['outfit'],
      );
    decor.value = snapshot.progress.decor;
    outfit.value = snapshot.progress.outfit;
    lighting.value = snapshot.progress.lighting;
    ghost.checked = snapshot.progress.ghost;
    roam.checked = snapshot.roaming;
    sound.checked = snapshot.sound;
    const count = snapshot.progress.completedFocusSessions;
    progressNote.textContent = snapshot.saveProblem
      ? 'Changes are available for this session. Your saved progress file was preserved.'
      : `${count} completed focus ${count === 1 ? 'session' : 'sessions'}`;
    if (snapshot.error) announce(snapshot.error, true);
  }

  async function change(change: HabitatChange) {
    if (!latest) return;
    announce('');
    if (!isTauri()) {
      const next = { ...latest, progress: { ...latest.progress } };
      if (change.setting === 'roaming' || change.setting === 'sound')
        next[change.setting] = change.value;
      else Object.assign(next.progress, { [change.setting]: change.value });
      render(next);
      return;
    }
    for (const control of controls) control.disabled = true;
    pending = setTimeout(() => {
      if (latest) render(latest);
      announce('Ember did not respond. Try the setting again.', true);
      void refreshHabitat().catch((error: unknown) =>
        announce(errorMessage(error), true),
      );
    }, 4000);
    try {
      await invoke('change_habitat_setting', { change });
    } catch (error) {
      render(latest);
      announce(errorMessage(error), true);
    }
  }

  async function refreshHabitat() {
    const started = revision;
    const snapshot = await invoke<HabitatSettings | null>(
      'read_habitat_settings',
    );
    if (snapshot && started === revision) render(snapshot);
  }

  type Login = { enabled: boolean; editable: boolean };
  function renderLogin(state: Login) {
    login.checked = state.enabled;
    login.disabled = !state.editable;
    if (!state.editable)
      loginHint.textContent = 'Available in the installed app.';
  }

  decor.addEventListener(
    'change',
    () =>
      void change({
        setting: 'decor',
        value: decor.value as 'none' | 'plant' | 'lantern',
      }),
  );
  outfit.addEventListener(
    'change',
    () =>
      void change({
        setting: 'outfit',
        value: outfit.value as 'none' | 'beanie' | 'scarf',
      }),
  );
  lighting.addEventListener(
    'change',
    () =>
      void change({
        setting: 'lighting',
        value: lighting.value === 'day' ? 'day' : 'auto',
      }),
  );
  for (const [setting, control] of [
    ['roaming', roam],
    ['ghost', ghost],
    ['sound', sound],
  ] as const) {
    control.addEventListener(
      'change',
      () => void change({ setting, value: control.checked }),
    );
  }
  login.addEventListener('change', () => {
    const enabled = login.checked;
    login.disabled = true;
    void invoke<Login>('set_launch_at_login', { enabled })
      .then(renderLogin)
      .catch((error: unknown) => {
        login.checked = !enabled;
        login.disabled = false;
        announce(errorMessage(error), true);
      });
  });

  let unlisten: (() => void) | undefined;
  if (isTauri()) {
    void listen<HabitatSettings>('habitat-settings', ({ payload }) =>
      render(payload),
    )
      .then((stop) => {
        if (stopped) stop();
        else unlisten = stop;
        return refreshHabitat();
      })
      .catch((error: unknown) => announce(errorMessage(error), true));
  } else {
    render({
      progress: freshProgress(),
      saveProblem: false,
      roaming: true,
      sound: false,
      error: null,
    });
  }

  return {
    section,
    async refresh() {
      if (isTauri())
        await Promise.all([
          refreshHabitat(),
          invoke<Login>('launch_at_login').then(renderLogin),
        ]);
    },
    dispose() {
      stopped = true;
      clearTimeout(pending);
      unlisten?.();
    },
  };
}
