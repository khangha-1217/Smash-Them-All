import { describe, expect, it } from 'vitest';
import { I18n, LOCALES } from '../../src/i18n/i18n';
import { EventEmitter } from '../../src/utils/event-emitter';
import { ProfileStorage } from '../../src/utils/storage';

describe('i18n', () => {
  it('starts in Vietnamese and resolves locale keys', () => {
    const i18n = new I18n(new ProfileStorage(() => undefined), new EventEmitter());
    expect(i18n.language).toBe('vi');
    expect(i18n.t('menu.start')).toBe('Bắt đầu');
    expect(i18n.number(12345)).toBe('12.345');
  });

  it('uses Vietnamese then the key when a translation is missing', () => {
    const i18n = new I18n(new ProfileStorage(() => undefined), new EventEmitter(), {
      vi: { fallback: 'Xin chào {name}!' }, en: {},
    });
    i18n.setLanguage('en');
    expect(i18n.t('fallback', { name: 'Mai' })).toBe('Xin chào Mai!');
    expect(i18n.t('missing')).toBe('missing');
    expect(i18n.t('toString')).toBe('toString');
  });

  it('interpolates every matching placeholder and keeps unresolved placeholders visible', () => {
    const i18n = new I18n(new ProfileStorage(() => undefined), new EventEmitter(), {
      vi: { template: '{points} / {points} / {rank}' }, en: {},
    });
    expect(i18n.t('template', { points: 0 })).toBe('0 / 0 / {rank}');
    expect(i18n.t('template')).toBe('{points} / {points} / {rank}');
  });

  it('keeps key sets and interpolation parameters identical across locales', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    expect(Object.keys(LOCALES.vi).sort()).toEqual(Object.keys(LOCALES.en).sort());
    for (const [key, value] of Object.entries(LOCALES.vi)) {
      expect(value.trim(), key).not.toBe('');
      expect(LOCALES.en[key].trim(), key).not.toBe('');
      expect(placeholders(LOCALES.en[key]), key).toEqual(placeholders(value));
    }
  });

  it('switches synchronously, emits once per change, and persists the active language', () => {
    const fields = new Map<string, string>();
    const backend = {
      getItem: (key: string) => fields.get(key) ?? null,
      setItem: (key: string, value: string) => { fields.set(key, value); },
    };
    const events = new EventEmitter();
    const storage = new ProfileStorage(() => backend);
    const i18n = new I18n(storage, events);
    const changes: string[] = [];
    events.on('LANGUAGE_CHANGED', ({ language }) => changes.push(language, i18n.t('menu.start')));
    i18n.setLanguage('en');
    i18n.setLanguage('en');
    expect(i18n.number(12345)).toBe('12,345');
    expect(changes).toEqual(['en', 'Start']);
    expect(new I18n(new ProfileStorage(() => backend), events).language).toBe('en');
    i18n.setLanguage('vi');
    expect(changes).toEqual(['en', 'Start', 'vi', 'Bắt đầu']);
  });

  it('changes only the language key after another tab saves a best score and mutes sound', () => {
    const fields = new Map<string, string>();
    const backend = {
      getItem: (key: string) => fields.get(key) ?? null,
      setItem: (key: string, value: string) => { fields.set(key, value); },
    };
    const staleTab = new I18n(new ProfileStorage(() => backend), new EventEmitter());
    const currentTab = new ProfileStorage(() => backend);
    currentTab.recordPersonalBest('kitchen', 'normal', 1_200);
    currentTab.setSoundEnabled(false);

    staleTab.setLanguage('en');

    expect(Object.fromEntries(fields)).toEqual({
      smash_em_all_language: '"en"',
      smash_em_all_personal_bests: '{"kitchen_normal":1200}',
      smash_em_all_sound: 'false',
    });
  });
});
