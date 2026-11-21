import type { I18n } from '../i18n/i18n';
import { button, copy, element, translateCopy } from './dom';

export class PauseOverlay {
  readonly root = element('section', 'modal-overlay');
  private readonly resume: HTMLButtonElement;
  private readonly status = element('p', 'load-status');

  constructor(private readonly i18n: I18n, onResume: () => void, onRestart: () => void, onQuit: () => void) {
    const card = element('div', 'card pause-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'pause-title');
    const title = copy(element('h2'), 'pause.title');
    title.id = 'pause-title';
    const actions = element('div', 'actions');
    this.resume = copy(button('', 'button primary', onResume), 'pause.resume');
    actions.append(
      this.resume,
      copy(button('', 'button secondary', onRestart), 'pause.restart'),
      copy(button('', 'button secondary', onQuit), 'menu.back'),
    );
    copy(this.status, 'pause.pointer');
    this.status.setAttribute('role', 'status');
    this.status.hidden = true;
    card.append(title, actions, this.status);
    this.root.append(card);
    this.root.hidden = true;
    this.localize();
  }

  show(): void {
    this.status.hidden = true;
    this.resume.focus();
  }

  lockFailed(): void {
    this.status.hidden = false;
  }

  localize(): void {
    translateCopy(this.root, this.i18n);
  }
}
