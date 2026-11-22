import {
  addPreviewClips,
  copyClip,
  editClipboard,
  native,
  readClipboard,
} from './api';
import {
  button,
  element,
  emptyState,
  errorMessage,
  type Announce,
} from './dom';
import { relativeTime, selectClips, type ClipboardSnapshot } from './model';

export function clipboardView(announce: Announce) {
  const section = element('section', 'clipboard-view');
  section.id = 'clipboard-panel';
  section.setAttribute('role', 'tabpanel');
  section.setAttribute('aria-labelledby', 'clipboard-tab');
  const heading = element('div', 'section-heading');
  heading.append(element('h2', '', 'Clipboard'));
  const tools = element('div', 'clipboard-tools');
  const searchLabel = element('label', 'search-box');
  const search = element('input');
  search.type = 'search';
  search.placeholder = 'Find a clip…';
  search.setAttribute('aria-label', 'Search clipboard history');
  const searchMark = element('span', 'search-mark', '⌕');
  searchMark.setAttribute('aria-hidden', 'true');
  searchLabel.append(searchMark, search);
  const pinned = button('Pinned', 'filter-button');
  pinned.setAttribute('aria-pressed', 'false');
  tools.append(searchLabel, pinned);
  const meta = element('div', 'list-meta');
  const count = element('span', '', 'Loading clipboard…');
  const clear = button('Clear all', 'text-button');
  meta.append(count, clear);
  const problem = element('p', 'inline-error');
  problem.hidden = true;
  const list = element('div', 'clip-list');
  const footer = element(
    'p',
    'privacy-note',
    '50 recent clips · 20 pins · text up to 16 KB',
  );
  section.append(heading, tools, meta, problem, list, footer);
  if (!native) {
    const samples = button('Load sample clips', 'preview-samples');
    samples.addEventListener('click', () => {
      addPreviewClips();
      void refresh();
    });
    section.append(samples);
  }
  let snapshot: ClipboardSnapshot | undefined;
  let onlyPinned = false;
  let busy = false;
  let operationVersion = 0;
  let renderKey = '';
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  function render(force = false) {
    if (!snapshot) return;
    problem.textContent = snapshot.error;
    problem.hidden = !snapshot.error;
    const entries = selectClips(snapshot.entries, search.value, onlyPinned);
    count.textContent = `${entries.length} ${onlyPinned ? 'pinned ' : ''}clip${entries.length === 1 ? '' : 's'}${snapshot.enabled ? ' · Capturing' : ' · Capture paused'}`;
    clear.disabled = !snapshot.entries.length || busy;
    const key = JSON.stringify([snapshot.revision, search.value, onlyPinned]);
    if (!force && renderKey === key) return;
    renderKey = key;
    // Keep keyboard focus on the same action when a refresh changes the list.
    const focused = list.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.action
      : undefined;
    const nodes = entries.map((entry) => {
      const item = element('article', 'clip-item');
      const top = element('div', 'clip-top');
      top.append(
        element(
          'span',
          'clip-kind',
          entry.pinned
            ? '◆ PINNED'
            : entry.text.includes('\n')
              ? 'TEXT NOTE'
              : 'TEXT',
        ),
      );
      const time = element('time', '', relativeTime(entry.copiedAt));
      time.dateTime = new Date(entry.copiedAt).toISOString();
      top.append(time);
      const text = element('p', 'clip-text', entry.text);
      const actions = element('div', 'clip-actions');
      const copy = button('Copy', 'copy-button');
      copy.dataset.action = `copy-${entry.id}`;
      copy.setAttribute('aria-label', `Copy clip: ${entry.text.slice(0, 50)}`);
      copy.addEventListener(
        'click',
        () =>
          void run(async () => {
            await copyClip(entry.id);
            announce('Copied. Ready to paste.');
          }),
      );
      const pin = button(entry.pinned ? 'Unpin' : 'Pin', 'text-button');
      pin.dataset.action = `pin-${entry.id}`;
      pin.setAttribute('aria-pressed', String(entry.pinned));
      pin.setAttribute(
        'aria-label',
        `${entry.pinned ? 'Unpin' : 'Pin'} clip: ${entry.text.slice(0, 50)}`,
      );
      pin.addEventListener(
        'click',
        () =>
          void run(async () => {
            snapshot = await editClipboard('pin', entry.id);
            announce(
              entry.pinned
                ? 'Snippet unpinned.'
                : 'Pinned. This snippet will stay after you quit.',
            );
          }),
      );
      const remove = button('Remove', 'text-button remove-button');
      remove.dataset.action = `remove-${entry.id}`;
      remove.setAttribute(
        'aria-label',
        `Remove clip: ${entry.text.slice(0, 50)}`,
      );
      remove.addEventListener(
        'click',
        () =>
          void run(async () => {
            snapshot = await editClipboard('remove', entry.id);
            announce('Clip removed.');
          }),
      );
      actions.append(copy, pin, remove);
      item.append(top, text, actions);
      return item;
    });
    list.replaceChildren(
      ...(nodes.length
        ? nodes
        : [
            emptyState(
              search.value
                ? 'No matching clips.'
                : onlyPinned
                  ? 'A home for your keepers.'
                  : 'A little space for useful things.',
              search.value
                ? 'Try another word or clear your search.'
                : onlyPinned
                  ? 'Pin a clip to keep it here after you quit.'
                  : snapshot.enabled
                    ? 'Copy some text in any app. Ember will keep it here.'
                    : 'Enable clipboard capture in menu bar Settings.',
            ),
          ]),
    );
    if (focused) {
      const target = Array.from(
        list.querySelectorAll<HTMLButtonElement>('button'),
      ).find((node) => node.dataset.action === focused);
      (target ?? search).focus();
    }
  }

  async function run(operation: () => Promise<void>) {
    if (busy) return;
    busy = true;
    operationVersion++;
    section.setAttribute('aria-busy', 'true');
    try {
      await operation();
    } catch (error) {
      announce(errorMessage(error), true);
    } finally {
      busy = false;
      section.removeAttribute('aria-busy');
      render(true);
    }
  }

  async function refresh() {
    if (busy) return;
    const version = operationVersion;
    const next = await readClipboard();
    if (busy || version !== operationVersion) return;
    snapshot = next;
    render();
  }

  search.addEventListener('input', () => render());
  pinned.addEventListener('click', () => {
    onlyPinned = !onlyPinned;
    pinned.setAttribute('aria-pressed', String(onlyPinned));
    render();
  });
  clear.addEventListener('click', () => {
    if (clear.textContent !== 'Clear everything?') {
      clear.textContent = 'Clear everything?';
      clearTimer = setTimeout(() => {
        clear.textContent = 'Clear all';
      }, 4000);
      return;
    }
    clearTimeout(clearTimer);
    clear.textContent = 'Clear all';
    void run(async () => {
      snapshot = await editClipboard('clear');
      announce('All clips and pinned snippets cleared.');
    });
  });

  return {
    section,
    refresh,
    focus: () => search.focus(),
    dispose: () => clearTimeout(clearTimer),
  };
}
