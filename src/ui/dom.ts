export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function button(label: string, className: string, action: () => void): HTMLButtonElement {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
import type { I18n } from '../i18n/i18n';


export function copy<T extends HTMLElement>(node: T, key: string): T {
  node.dataset.locale = key;
  return node;
}

export function translateCopy(root: HTMLElement, i18n: I18n): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-locale]')) {
    node.textContent = i18n.t(node.dataset.locale!);
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-locale-label]')) {
    node.setAttribute('aria-label', i18n.t(node.dataset.localeLabel!));
  }
}
