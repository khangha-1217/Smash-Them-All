import type { RoundConfig } from '../core/types';
import { button, element } from './dom';

const MAPS = [
  { id: 'kitchen', label: 'Nhà bếp' },
  { id: 'livingroom', label: 'Phòng khách' },
  { id: 'bedroom', label: 'Phòng ngủ' },
] as const;
const MODES = [{ id: 'normal', label: 'Thường' }, { id: 'hell', label: 'Địa ngục' }] as const;
const WEAPONS = [
  { id: 'slipper', label: 'Dép' },
  { id: 'flyswatter', label: 'Vỉ đập' },
  { id: 'cardboard', label: 'Bìa cứng' },
] as const;

const DEFAULT_SELECTION: RoundConfig = { mapId: 'kitchen', mode: 'normal', weaponId: 'slipper' };

export class StartScreen {
  readonly root = element('section', 'menu-overlay');
  private readonly card = element('div', 'card menu-card');
  private readonly choices = element('div', 'choices');
  private readonly startButton: HTMLButtonElement;
  private readonly progress = element('progress', 'load-progress');
  private readonly status = element('p', 'load-status');
  private config = { ...DEFAULT_SELECTION };

  constructor(onStart: (config: RoundConfig) => void, private readonly onSelect: (config: RoundConfig) => void) {
    const title = element('h1', 'brand');
    title.append(element('span', 'brand-smash', 'Smash'), element('span', 'brand-rest', '’Em All'));
    title.setAttribute('aria-label', 'Smash ’Em All');

    this.choices.append(
      this.selector('Căn phòng', 'mapId', MAPS, 'map-choices'),
      this.selector('Chế độ', 'mode', MODES, 'mode-choices'),
      this.selector('Vũ khí', 'weaponId', WEAPONS, 'weapon-choices'),
    );
    this.startButton = button('Bắt đầu', 'button primary start-button', () => onStart(this.selection));
    this.progress.max = 1;
    this.progress.setAttribute('aria-label', 'Tiến độ tải');
    this.status.setAttribute('role', 'status');
    this.card.append(title, this.choices, this.startButton, this.progress, this.status);
    this.root.append(this.card);
    this.menu();
  }

  get selection(): RoundConfig {
    return { ...this.config };
  }

  menu(error = ''): void {
    this.root.hidden = false;
    this.card.dataset.state = 'menu';
    this.startButton.disabled = false;
    this.startButton.textContent = 'Bắt đầu';
    this.choices.inert = false;
    this.progress.hidden = true;
    this.status.textContent = error;
    this.status.hidden = !error;
  }

  loading(): void {
    this.root.hidden = false;
    this.card.dataset.state = 'loading';
    this.startButton.disabled = true;
    this.startButton.textContent = 'Đang tải…';
    this.choices.inert = true;
    this.status.hidden = true;
    this.progress.hidden = false;
    this.progress.value = 0;
  }

  setProgress(fraction: number): void {
    this.progress.value = fraction;
  }

  ready(waitingForPointer: boolean, lockPending: boolean): void {
    this.card.dataset.state = 'ready';
    this.progress.hidden = true;
    this.startButton.textContent = 'Bắt đầu';
    this.startButton.disabled = lockPending;
    this.status.textContent = waitingForPointer ? 'Bấm Bắt đầu để điều khiển góc nhìn.' : '';
    this.status.hidden = !waitingForPointer;
  }

  private selector<K extends keyof RoundConfig>(
    label: string,
    field: K,
    options: readonly { id: RoundConfig[K]; label: string }[],
    className: string,
  ): HTMLElement {
    const row = element('fieldset', `selector ${className}`);
    row.append(element('legend', 'selector-label', label));
    const list = element('div', 'selector-options');
    for (const option of options) {
      const item = element('label', 'choice');
      const radio = element('input');
      radio.type = 'radio';
      radio.name = field;
      radio.value = option.id;
      radio.checked = option.id === this.config[field];
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        this.config[field] = option.id;
        this.onSelect(this.selection);
      });
      const caption = element('span', 'choice-label');
      if (field === 'weaponId') {
        const icon = element('span', `weapon-icon ${option.id}`);
        icon.setAttribute('aria-hidden', 'true');
        caption.append(icon);
      }
      caption.append(document.createTextNode(option.label));
      item.append(radio, caption);
      list.append(item);
    }
    row.append(list);
    return row;
  }
}
