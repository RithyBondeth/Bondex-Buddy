import { invoke, isTauri } from '@tauri-apps/api/core';
import { button, element, errorMessage, type Announce } from './dom';
import { icon } from './icons';

interface PouchFile {
  id: string;
  name: string;
  size: number;
  expiresAt: number;
}

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${number.format(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${number.format(bytes / 1024 ** 2)} MB`;
  return `${number.format(bytes / 1024 ** 3)} GB`;
}

function timeLeft(expiresAt: number, now: number): string {
  const minutes = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h left`;
}

export function pouchView(announce: Announce) {
  const native = isTauri();
  const section = element('section', 'pouch-view');
  section.id = 'files-panel';
  section.setAttribute('role', 'tabpanel');
  section.setAttribute('aria-labelledby', 'files-tab');
  const heading = element('div', 'pouch-heading');
  const count = element('span', 'pouch-count');
  heading.append(element('h2', '', 'File pouch'), count);
  const empty = element(
    'p',
    'pouch-empty',
    native
      ? 'Drop files onto Ember. Temporary copies stay for 24 hours.'
      : 'File drops are available in the desktop app.',
  );
  const entries = element('ul', 'pouch-files');
  entries.setAttribute('aria-label', 'Temporary files');
  section.append(heading, empty, entries);

  let files: PouchFile[] = [];
  let rendering = '';
  let busy = false;
  let version = 0;

  function render() {
    const now = Date.now();
    const times = files.map((file) => timeLeft(file.expiresAt, now));
    const key = JSON.stringify([files, times, busy]);
    if (key === rendering) return;
    rendering = key;
    count.textContent = files.length ? String(files.length) : '';
    empty.hidden = files.length > 0;
    const focused = (document.activeElement as HTMLElement | null)?.dataset
      .pouchAction;
    entries.replaceChildren(
      ...files.map((file, index) => row(file, times[index])),
    );
    if (focused)
      [...entries.querySelectorAll('button')]
        .find((item) => item.dataset.pouchAction === focused)
        ?.focus({ preventScroll: true });
  }

  function row(file: PouchFile, remaining: string) {
    const item = element('li', 'pouch-file');
    const handle = element('div', 'pouch-file-handle');
    handle.title = `Drag ${file.name} into another app`;
    const information = element('div', 'pouch-file-info');
    const name = element('strong', '', file.name);
    name.title = file.name;
    const meta = element('small', '', `${fileSize(file.size)} · ${remaining}`);
    meta.title = `Expires ${new Date(file.expiresAt).toLocaleString()}`;
    information.append(name, meta);
    handle.append(icon('files'), information);
    let start: { x: number; y: number } | null = null;
    handle.addEventListener('pointerdown', (event) => {
      if (!native || busy || event.button !== 0) return;
      event.preventDefault();
      start = { x: event.screenX, y: event.screenY };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (
        !start ||
        Math.hypot(start.x - event.screenX, start.y - event.screenY) < 5
      )
        return;
      start = null;
      void invoke('pouch_drag', { id: file.id }).catch((error: unknown) =>
        announce(errorMessage(error), true),
      );
    });
    const end = () => {
      start = null;
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('lostpointercapture', end);

    const actions = element('div', 'pouch-file-actions');
    const extend = button('+24h', 'task-button');
    extend.setAttribute('aria-label', `Keep ${file.name} for 24 more hours`);
    extend.dataset.pouchAction = `extend-${file.id}`;
    const remove = button('Remove', 'text-button');
    remove.setAttribute('aria-label', `Remove temporary copy of ${file.name}`);
    remove.dataset.pouchAction = `remove-${file.id}`;
    extend.disabled = remove.disabled = busy;
    extend.addEventListener('click', () => void edit(file, 'extend'));
    remove.addEventListener('click', () => void edit(file, 'remove'));
    actions.append(extend, remove);
    item.append(handle, actions);
    return item;
  }

  async function edit(file: PouchFile, action: 'extend' | 'remove') {
    if (busy || !native) return;
    busy = true;
    version++;
    try {
      await invoke('pouch_edit', { id: file.id, action });
      announce(
        action === 'extend'
          ? 'Kept for 24 more hours.'
          : 'Temporary copy removed.',
      );
    } catch (error) {
      announce(errorMessage(error), true);
    } finally {
      busy = false;
      await refresh().catch((error: unknown) =>
        announce(errorMessage(error), true),
      );
    }
  }

  async function refresh() {
    if (!native || busy) return;
    const pending = version;
    const fresh = await invoke<PouchFile[]>('pouch_files');
    if (!busy && pending === version) {
      files = fresh;
      render();
    }
  }

  return { section, refresh };
}
