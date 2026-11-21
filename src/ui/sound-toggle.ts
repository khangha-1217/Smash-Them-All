import type { I18n } from '../i18n/i18n';
import type { EventEmitter } from '../utils/event-emitter';
import { button } from './dom';

export class SoundToggle {
  readonly root: HTMLButtonElement;

  constructor(private readonly i18n: I18n, events: EventEmitter, className: string, private enabled: boolean) {
    this.root = button('', className, () => events.emit('SOUND_TOGGLED', { enabled: !this.enabled }));
    events.on('SOUND_TOGGLED', ({ enabled }) => {
      this.enabled = enabled;
      this.localize();
    });
    this.localize();
  }

  localize(): void {
    this.root.textContent = this.i18n.t(this.enabled ? 'audio.on' : 'audio.off');
    this.root.setAttribute('aria-label', this.i18n.t('audio.label'));
    this.root.setAttribute('aria-pressed', String(this.enabled));
  }
}
