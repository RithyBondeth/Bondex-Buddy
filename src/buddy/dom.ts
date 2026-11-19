export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text: string, className = ''): HTMLButtonElement {
  const node = element('button', className, text);
  node.type = 'button';
  return node;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type Announce = (text: string, error?: boolean) => void;

export function emptyState(title: string, description: string): HTMLElement {
  const node = element('div', 'empty-state');
  const illustration = element('span', 'empty-mark');
  illustration.append(icon('pocket'));
  illustration.setAttribute('aria-hidden', 'true');
  node.append(
    illustration,
    element('h3', '', title),
    element('p', '', description),
  );
  return node;
}
import { icon } from './icons';
