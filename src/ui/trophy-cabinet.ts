import { ACHIEVEMENT_IDS } from '../core/achievement-tracker';
import type { AchievementId } from '../core/achievement-tracker';
import type { I18n } from '../i18n/i18n';
import type { ProfilePersistence } from '../utils/storage';
import { button, copy, element, translateCopy } from './dom';

export function badgeCard(i18n: I18n, id: AchievementId, unlocked: boolean): HTMLLIElement {
  const card = element('li', 'badge-card');
  card.dataset.achievement = id;
  card.dataset.unlocked = String(unlocked);
  const status = element('span', 'badge-status', i18n.t(unlocked ? 'trophy.unlocked' : 'trophy.locked'));
  const name = element('strong', 'badge-name', i18n.t(`achievement.${id}.name`));
  const message = element('p', 'badge-message', i18n.t(`achievement.${id}.${unlocked ? 'flavor' : 'hint'}`));
  card.append(status, name, message);
  return card;
}

export class TrophyCabinet {
  readonly root = element('section', 'modal-overlay trophy-overlay');
  private readonly grid = element('ul', 'badge-grid');
  private readonly count = element('p', 'trophy-count');
  private readonly back: HTMLButtonElement;

  constructor(private readonly i18n: I18n, private readonly storage: ProfilePersistence, onClose: () => void) {
    const card = element('div', 'card trophy-card');
    const title = copy(element('h2'), 'menu.trophies');
    title.id = 'trophy-title';
    const header = element('header', 'trophy-header');
    const heading = element('div');
    heading.append(title, this.count);
    this.back = copy(button('', 'button secondary', onClose), 'menu.back');
    header.append(heading, this.back);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', title.id);
    card.append(header, this.grid);
    this.root.append(card);
    this.root.hidden = true;
    this.root.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        this.back.focus();
      }
    });
  }

  show(): void {
    this.root.hidden = false;
    this.root.scrollTop = 0;
    this.localize();
    this.back.focus({ preventScroll: true });
  }

  localize(): void {
    if (this.root.hidden) return;
    const { achievements } = this.storage.load();
    const badges = ACHIEVEMENT_IDS.map(id => badgeCard(this.i18n, id, achievements[id] === true));
    this.grid.replaceChildren(...badges);
    this.count.textContent = this.i18n.t('trophy.count', {
      count: ACHIEVEMENT_IDS.filter(id => achievements[id] === true).length,
      total: ACHIEVEMENT_IDS.length,
    });
    translateCopy(this.root, this.i18n);
  }
}
