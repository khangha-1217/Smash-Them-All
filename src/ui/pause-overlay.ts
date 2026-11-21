import { button, element } from './dom';

export class PauseOverlay {
  readonly root = element('section', 'modal-overlay');
  private readonly resume: HTMLButtonElement;
  private readonly status = element('p', 'load-status');

  constructor(onResume: () => void, onQuit: () => void) {
    const card = element('div', 'card pause-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'pause-title');
    const title = element('h2', '', 'Tạm dừng');
    title.id = 'pause-title';
    const actions = element('div', 'actions');
    this.resume = button('Tiếp tục', 'button primary', onResume);
    actions.append(this.resume, button('Về menu', 'button secondary', onQuit));
    this.status.setAttribute('role', 'status');
    this.status.hidden = true;
    card.append(title, actions, this.status);
    this.root.append(card);
    this.root.hidden = true;
  }

  show(): void {
    this.root.hidden = false;
    this.status.hidden = true;
    this.resume.focus();
  }

  lockFailed(): void {
    this.status.textContent = 'Bấm Tiếp tục để điều khiển góc nhìn.';
    this.status.hidden = false;
  }
}
