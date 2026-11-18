import { mountApp } from './app/mount';
import { revealStartupError } from './platform/desktop';
import './styles/base.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root is missing.');

let dispose: (() => void) | undefined;
let stopped = false;
import.meta.hot?.dispose(() => {
  stopped = true;
  dispose?.();
});
void mountApp(root)
  .then((cleanup) => {
    if (stopped) cleanup();
    else dispose = cleanup;
  })
  .catch(async (error: unknown) => {
    console.error('Habitat startup failed:', error);
    const message = document.createElement('p');
    message.className = 'startup-error';
    message.textContent =
      'The spirit could not load. Quit from the tray and reopen.';
    root.replaceChildren(message);
    await revealStartupError().catch(console.error);
  });
