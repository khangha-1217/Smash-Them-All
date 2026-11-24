import type { RoundConfig } from '../core/types';
import type { I18n } from '../i18n/i18n';
import type { EventEmitter } from '../utils/event-emitter';
import { button, copy, element, translateCopy } from './dom';
import { SoundToggle } from './sound-toggle';

const MAPS = ['kitchen', 'livingroom', 'bedroom'] as const;
const MODES = ['normal', 'hell'] as const;
const WEAPONS = ['slipper', 'flyswatter', 'cardboard'] as const;

const DEFAULT_SELECTION: RoundConfig = { mapId: 'kitchen', mode: 'normal', weaponId: 'slipper' };
type MenuStatus = 'menu.loadError' | 'menu.pointer' | '';

export class StartScreen {
  readonly root = element('section', 'menu-overlay');
  private readonly card = element('div', 'card menu-card');
  private readonly choices = element('div', 'choices');
  private readonly startButton: HTMLButtonElement;
  private readonly progress = element('progress', 'load-progress');
  private readonly status = element('p', 'load-status');
  private readonly actions = element('div', 'actions menu-actions');
  private readonly trophies: HTMLButtonElement;
  private readonly sound: SoundToggle;
  private statusKey: MenuStatus = '';
  private config = { ...DEFAULT_SELECTION };

  constructor(
    private readonly i18n: I18n,
    events: EventEmitter,
    soundEnabled: boolean,
    onStart: (config: RoundConfig) => void,
    private readonly onSelect: (config: RoundConfig) => void,
    onTrophies: () => void,
  ) {
    const title = element('h1', 'brand');
    title.append(copy(element('span', 'brand-smash'), 'brand.first'), copy(element('span', 'brand-rest'), 'brand.rest'));
    title.dataset.localeLabel = 'brand.title';

    this.choices.append(
      this.selector('room', 'mapId', MAPS, 'map'),
      this.selector('mode', 'mode', MODES, 'mode'),
      this.selector('weapon', 'weaponId', WEAPONS, 'weapon'),
    );
    this.startButton = button('', 'button primary start-button', () => onStart(this.selection));
    this.trophies = copy(button('', 'button secondary trophy-button', onTrophies), 'menu.trophies');
    this.trophies.setAttribute('aria-haspopup', 'dialog');
    const language = copy(button('', 'button secondary language-button', () => {
      i18n.setLanguage(i18n.language === 'vi' ? 'en' : 'vi');
    }), 'menu.language');
    language.dataset.localeLabel = 'menu.languageLabel';
    this.sound = new SoundToggle(i18n, events, 'button secondary menu-sound', soundEnabled);
    this.actions.append(this.trophies, language, this.sound.root);
    this.progress.max = 1;
    this.progress.dataset.localeLabel = 'menu.loadProgress';
    this.status.setAttribute('role', 'status');
    this.card.append(title, this.choices, this.startButton, this.actions, this.progress, this.status);
    this.root.append(this.card);
    this.menu();
  }

  get selection(): RoundConfig {
    return { ...this.config };
  }

  menu(loadFailed = false): void {
    this.card.dataset.state = 'menu';
    this.startButton.disabled = false;
    this.disableChoices(false);
    this.trophies.disabled = false;
    this.progress.hidden = true;
    this.setStatus(loadFailed ? 'menu.loadError' : '');
    this.localize();
  }

  loading(): void {
    this.card.dataset.state = 'loading';
    this.startButton.disabled = true;
    this.disableChoices(true);
    this.trophies.disabled = true;
    this.setStatus('');
    this.progress.hidden = false;
    this.progress.value = 0;
    this.localize();
  }

  setProgress(fraction: number): void {
    this.progress.value = fraction;
  }

  ready(waitingForPointer: boolean, lockPending: boolean): void {
    this.card.dataset.state = 'ready';
    this.progress.hidden = true;
    this.startButton.disabled = lockPending;
    this.setStatus(waitingForPointer ? 'menu.pointer' : '');
    this.localize();
  }

  localize(): void {
    translateCopy(this.root, this.i18n);
    this.sound.localize();
    this.startButton.textContent = this.i18n.t(this.card.dataset.state === 'loading' ? 'menu.loading' : 'menu.start');
    this.status.textContent = this.statusKey ? this.i18n.t(this.statusKey) : '';
  }

  focusTrophies(): void {
    this.trophies.focus();
  }

  private setStatus(key: MenuStatus): void {
    this.statusKey = key;
    this.status.hidden = !key;
  }

  private disableChoices(disabled: boolean): void {
    for (const fieldset of this.choices.querySelectorAll('fieldset')) fieldset.disabled = disabled;
    this.choices.classList.toggle('disabled', disabled);
  }

  private selector<K extends keyof RoundConfig>(
    label: string,
    field: K,
    options: readonly RoundConfig[K][],
    context: 'map' | 'mode' | 'weapon',
  ): HTMLElement {
    const row = element('fieldset', `selector ${context}-choices`);
    row.append(copy(element('legend', 'selector-label'), `menu.${label}`));
    const list = element('div', 'selector-options');
    for (const id of options) {
      const item = element('label', 'choice');
      const radio = element('input');
      radio.type = 'radio';
      radio.name = field;
      radio.value = id;
      radio.checked = id === this.config[field];
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        this.config[field] = id;
        this.onSelect(this.selection);
      });
      const caption = element('span', 'choice-label');
      if (field === 'weaponId') {
        const icon = element('span', `weapon-icon ${id}`);
        icon.setAttribute('aria-hidden', 'true');
        caption.append(icon);
      }
      caption.append(copy(element('span'), `${context}.${id}`));
      item.append(radio, caption);
      list.append(item);
    }
    row.append(list);
    return row;
  }
}
