import type { I18n } from '../i18n/i18n';
import { copy, element, translateCopy } from './dom';

export class OrientationPrompt {
  readonly root = element('section', 'modal-overlay orientation-overlay');
  private readonly title = copy(element('h2'), 'orientation.title');
  private readonly portraitViewport = window.matchMedia('(orientation: portrait)');
  readonly mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches
      && Math.min(screen.width, screen.height) <= 600);

  constructor(private readonly i18n: I18n, onChange: () => void) {
    const card = element('div', 'card orientation-card');
    this.title.id = 'orientation-title';
    card.append(this.title);
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', this.title.id);
    this.root.append(card);
    this.root.hidden = true;
    this.root.tabIndex = -1;
    this.portraitViewport.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    this.localize();
  }

  get portrait(): boolean {
    return this.mobile && this.portraitViewport.matches;
  }

  show(portrait: boolean): void {
    if (this.root.hidden === !portrait) return;
    this.root.hidden = !portrait;
    if (portrait) this.root.focus({ preventScroll: true });
  }

  localize(): void {
    translateCopy(this.root, this.i18n);
  }
}
