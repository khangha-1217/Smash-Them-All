import type { GameMode } from '../core/types';
import type { I18n } from '../i18n/i18n';
import type { EventEmitter } from '../utils/event-emitter';
import { button, copy, element, translateCopy } from './dom';

export class Hud {
  readonly root = element('section', 'hud');
  readonly reticle = element('div', 'reticle');
  readonly effects = element('div', 'effects');
  readonly joystick = element('div', 'joystick');
  private readonly mode = element('div', 'chip mode-badge');
  private readonly timer = element('div', 'timer');
  private readonly score = element('strong', 'score-value');
  private readonly combo = element('div', 'chip combo');
  private readonly kills = element('strong', 'kill-value');
  private readonly flightWarning = copy(element('div', 'chip flight-warning'), 'hud.flight');
  private readonly preparingToFly = new Set<number>();
  private currentMode: GameMode = 'normal';
  private currentScore = 0;
  private currentKills = 0;
  private multiplier = 1;

  constructor(private readonly i18n: I18n, events: EventEmitter, onPause: () => void) {
    const board = element('div', 'scoreboard');
    this.timer.setAttribute('role', 'timer');
    this.timer.dataset.localeLabel = 'hud.time';
    const scoreLine = element('div', 'score-line');
    scoreLine.append(copy(element('span'), 'hud.score'), this.score);
    board.append(this.timer, scoreLine);

    const killBadge = element('div', 'chip kills');
    killBadge.append(copy(element('span'), 'hud.kills'), this.kills);

    const controls = element('div', 'control-hints');
    for (const action of ['move', 'swing', 'pause']) {
      const hint = element('span', 'control-hint');
      hint.append(copy(element('kbd'), `hud.${action}Key`), copy(element('span'), `hud.${action}`));
      controls.append(hint);
    }

    this.effects.setAttribute('aria-hidden', 'true');
    this.reticle.setAttribute('aria-hidden', 'true');
    this.flightWarning.setAttribute('role', 'status');
    this.flightWarning.hidden = true;
    const pauseButton = button('Ⅱ', 'button secondary touch-pause', onPause);
    pauseButton.dataset.localeLabel = 'hud.pause';
    this.joystick.setAttribute('aria-hidden', 'true');
    this.root.append(this.mode, board, this.combo, killBadge, controls, this.reticle, this.effects,
      this.flightWarning, this.joystick, pauseButton);
    this.root.hidden = true;

    events.on('ROUND_STARTED', ({ mode }) => this.reset(mode));
    events.on('TIMER_TICK', ({ timeRemaining }) => this.updateTimer(timeRemaining));
    events.on('SCORE_UPDATED', ({ score }) => {
      this.currentScore = score;
      this.score.textContent = i18n.number(score);
    });
    events.on('KILL_COUNT_UPDATED', ({ kills }) => {
      this.currentKills = kills;
      this.kills.textContent = i18n.number(kills);
    });
    events.on('COMBO_UPDATED', ({ multiplier }) => this.updateCombo(multiplier));
    events.on('COMBO_RESET', () => this.updateCombo(1));
    events.on('COCKROACH_PREFLIGHT', ({ cockroachId }) => {
      this.preparingToFly.add(cockroachId);
      this.flightWarning.hidden = false;
      this.flightWarning.classList.remove('pop');
      void this.flightWarning.offsetWidth;
      this.flightWarning.classList.add('pop');
    });
    events.on('COCKROACH_FLYING', ({ cockroachId }) => this.clearFlightWarning(cockroachId));
    events.on('COCKROACH_DESPAWNED', ({ cockroachId }) => this.clearFlightWarning(cockroachId));
    this.localize();
  }

  localize(): void {
    translateCopy(this.root, this.i18n);
    this.mode.textContent = this.i18n.t(`mode.${this.currentMode}`);
    this.score.textContent = this.i18n.number(this.currentScore);
    this.kills.textContent = this.i18n.number(this.currentKills);
    this.localizeCombo();
  }

  private reset(mode: GameMode): void {
    this.preparingToFly.clear();
    this.flightWarning.hidden = true;
    this.mode.dataset.mode = mode;
    this.currentMode = mode;
    this.currentScore = 0;
    this.currentKills = 0;
    this.updateTimer(90);
    this.localize();
    this.updateCombo(1);
  }

  private clearFlightWarning(cockroachId: number): void {
    this.preparingToFly.delete(cockroachId);
    this.flightWarning.hidden = this.preparingToFly.size === 0;
  }

  private updateTimer(seconds: number): void {
    const whole = Math.ceil(seconds);
    const pad = (value: number) => String(value).padStart(2, '0');
    this.timer.textContent = `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
    this.timer.classList.toggle('urgent', whole <= 10);
  }

  private updateCombo(multiplier: number): void {
    this.multiplier = multiplier;
    this.combo.hidden = multiplier < 2;
    this.localizeCombo();
    if (this.combo.hidden) return;

    this.combo.classList.remove('pop');
    void this.combo.offsetWidth;
    this.combo.classList.add('pop');
  }

  private localizeCombo(): void {
    this.combo.textContent = this.i18n.t('hud.combo', { multiplier: this.multiplier });
  }
}
