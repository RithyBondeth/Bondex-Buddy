import { revealHabitat } from '../platform/desktop';
import { renderHabitat } from '../rendering/habitat';

/** Phase 1 wires a static Canvas to the desktop shell, with no mood engine yet. */
export async function mountApp(root: HTMLElement): Promise<void> {
  const pet = document.createElement('button');
  pet.className = 'habitat';
  pet.type = 'button';
  pet.setAttribute('aria-label', 'Greet the test spirit');
  pet.title = 'Hello! Use the tray menu to move, hide, or quit.';
  const canvas = document.createElement('canvas');
  canvas.width = 110;
  canvas.height = 100;
  canvas.setAttribute('aria-hidden', 'true');
  pet.append(canvas);
  root.replaceChildren(pet);
  const mask = await renderHabitat(canvas);
  await revealHabitat(mask);
  let greeting: ReturnType<typeof setTimeout> | undefined;
  pet.addEventListener('click', () => {
    clearTimeout(greeting);
    pet.classList.add('is-greeting');
    greeting = setTimeout(() => pet.classList.remove('is-greeting'), 600);
  });
}
