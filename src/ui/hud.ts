import type { GameMode } from '../core/types';
import type { EventEmitter } from '../utils/event-emitter';
import { element } from './dom';

export class Hud {
  readonly root = element('section', 'hud');
  readonly reticle = element('div', 'reticle');
  readonly effects = element('div', 'effects');
  private readonly mode = element('div', 'chip mode-badge');
  private readonly timer = element('div', 'timer');
  private readonly score = element('strong', 'score-value');
  private readonly combo = element('div', 'chip combo');
  private readonly kills = element('strong', 'kill-value');
  private readonly flightWarning = element('div', 'chip flight-warning', '⚠️ Nó bay!');
  private readonly preparingToFly = new Set<number>();

  constructor(events: EventEmitter) {
    const board = element('div', 'scoreboard');
    this.timer.setAttribute('role', 'timer');
    this.timer.setAttribute('aria-label', 'Thời gian còn lại');
    const scoreLine = element('div', 'score-line');
    scoreLine.append(element('span', '', 'Điểm'), this.score);
    board.append(this.timer, scoreLine);

    const killBadge = element('div', 'chip kills');
    killBadge.append(element('span', '', 'Gián'), this.kills);

    const controls = element('div', 'control-hints');
    for (const [key, label] of [['WASD', 'Di chuyển'], ['Chuột', 'Đập'], ['Esc', 'Dừng']]) {
      const hint = element('span', 'control-hint');
      hint.append(element('kbd', '', key), document.createTextNode(label));
      controls.append(hint);
    }

    this.effects.setAttribute('aria-hidden', 'true');
    this.reticle.setAttribute('aria-hidden', 'true');
    this.flightWarning.setAttribute('role', 'status');
    this.flightWarning.hidden = true;
    this.root.append(this.mode, board, this.combo, killBadge, controls, this.reticle, this.effects, this.flightWarning);
    this.root.hidden = true;

    events.on('ROUND_STARTED', ({ mode }) => this.reset(mode));
    events.on('TIMER_TICK', ({ timeRemaining }) => this.updateTimer(timeRemaining));
    events.on('SCORE_UPDATED', ({ score }) => { this.score.textContent = this.format(score); });
    events.on('KILL_COUNT_UPDATED', ({ kills }) => { this.kills.textContent = this.format(kills); });
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
  }

  private reset(mode: GameMode): void {
    this.preparingToFly.clear();
    this.flightWarning.hidden = true;
    this.mode.dataset.mode = mode;
    this.mode.textContent = mode === 'hell' ? 'Địa ngục' : 'Thường';
    this.updateTimer(90);
    this.score.textContent = this.format(0);
    this.kills.textContent = this.format(0);
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
    this.combo.hidden = multiplier < 2;
    this.combo.textContent = `×${multiplier}!`;
    if (this.combo.hidden) return;

    this.combo.classList.remove('pop');
    void this.combo.offsetWidth;
    this.combo.classList.add('pop');
  }

  private format(value: number): string {
    return value.toLocaleString('vi-VN');
  }
}
