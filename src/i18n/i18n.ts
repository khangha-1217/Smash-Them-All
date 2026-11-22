import type { Language } from '../core/types';
import type { EventEmitter } from '../utils/event-emitter';
import type { ProfilePersistence } from '../utils/storage';
import en from './locales/en.json';
import vi from './locales/vi.json';

type Locales = Record<Language, Record<string, string>>;
export const LOCALES: Locales = { vi, en };

export class I18n {
  private activeLanguage: Language;

  constructor(
    private readonly storage: Pick<ProfilePersistence, 'load' | 'setLanguage'>,
    private readonly events: EventEmitter,
    private readonly locales: Locales = LOCALES,
  ) {
    this.activeLanguage = storage.load().language;
  }

  get language(): Language {
    return this.activeLanguage;
  }

  setLanguage(language: Language): void {
    if (language === this.activeLanguage) return;
    this.activeLanguage = language;
    this.storage.setLanguage(language);
    this.events.emit('LANGUAGE_CHANGED', { language });
  }

  t(key: string, params: Record<string, string | number> = {}): string {
    const active = this.locales[this.activeLanguage];
    const fallback = this.locales.vi;
    const hasKey = (values: Record<string, string | number>, name: string) =>
      Object.prototype.hasOwnProperty.call(values, name);
    const text = hasKey(active, key) ? active[key] : hasKey(fallback, key) ? fallback[key] : key;
    return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => (
      hasKey(params, name) ? String(params[name]) : placeholder
    ));
  }

  number(value: number): string {
    return value.toLocaleString(this.activeLanguage);
  }
}
