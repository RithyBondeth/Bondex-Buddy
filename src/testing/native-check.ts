import { invoke, isTauri } from '@tauri-apps/api/core';
import './native-check.css';
import { createHabitatRenderer } from '../rendering/habitat';
import type { Mood } from '../engine/spirit';

const gallery = document.querySelector('#gallery')!;
for (const mood of [
  'Idle',
  'Working',
  'Sleeping',
  'TeaBreak',
  'Happy',
] satisfies Mood[]) {
  const figure = document.createElement('figure');
  const canvas = document.createElement('canvas');
  canvas.width = 110;
  canvas.height = 100;
  const caption = document.createElement('figcaption');
  caption.textContent = mood;
  figure.append(canvas, caption);
  gallery.append(figure);
  void createHabitatRenderer(canvas)
    .then((renderer) => {
      const mask = renderer.draw(mood, 0, true);
      if (mask.length !== 11000 || mask.some((v) => v !== 0 && v !== 1)) {
        caption.textContent = `${mood}: invalid mask`;
      }
    })
    .catch((error: unknown) => {
      caption.textContent = `${mood}: ${String(error)}`;
    });
}

const counter = document.querySelector<HTMLElement>('#counter')!;
const status = document.querySelector<HTMLElement>('#status')!;
const outline = document.querySelector<HTMLElement>('#outline')!;
let clicks = 0;
let commandError = '';
document.querySelector('#surface')!.addEventListener('click', (event) => {
  const mouse = event as MouseEvent;
  counter.textContent = `Background clicks: ${++clicks} · last ${Math.round(mouse.clientX)},${Math.round(mouse.clientY)}`;
});
document
  .querySelectorAll<HTMLButtonElement>('[data-action]')
  .forEach((button) => {
    button.disabled = !isTauri();
    button.addEventListener('click', () => {
      commandError = '';
      void invoke('native_check_action', {
        action: button.dataset.action,
      }).catch((error: unknown) => {
        commandError = String(error);
      });
    });
  });
interface Diagnostics {
  x: number;
  y: number;
  scale: number;
  ignored: boolean;
  ghost: boolean;
  visible: boolean;
}
const poll = async () => {
  if (!isTauri()) {
    status.textContent =
      'Browser click-through target · native actions disabled';
    outline.hidden = true;
    return;
  }
  try {
    const d = await invoke<Diagnostics>('native_check_status');
    status.textContent = `Overlay ${d.x},${d.y} · scale ${d.scale} · ignored ${d.ignored} · ghost ${d.ghost} · visible ${d.visible}${commandError ? ` · ${commandError}` : ''}`;
    outline.style.left = `${d.x}px`;
    outline.style.top = `${d.y}px`;
  } catch (error) {
    status.textContent = String(error);
  }
};
void poll();
const interval = setInterval(() => {
  void poll();
}, 500);
window.addEventListener('beforeunload', () => clearInterval(interval));
