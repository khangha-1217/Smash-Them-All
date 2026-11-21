import type { RoundResult } from '../core/types';
import { button, element } from './dom';

export class GameOverScreen {
  readonly root = element('section', 'modal-overlay results-overlay');
  private readonly card = element('div', 'card results-card');
  private readonly score = element('strong', 'result-score');
  private readonly rank = element('span', 'rank-stamp');
  private readonly stats = element('dl', 'results-stats');
  private readonly best = element('p', 'personal-best');
  private readonly next = element('p', 'next-rank');
  private readonly replay: HTMLButtonElement;
  private animation = 0;

  constructor(onReplay: () => void, onMenu: () => void) {
    const title = element('h2', '', 'Hết giờ!');
    title.id = 'results-title';
    const summary = element('div', 'result-summary');
    const scoreGroup = element('div');
    scoreGroup.append(element('span', 'selector-label', 'Tổng điểm'), this.score);
    summary.append(scoreGroup, this.rank);

    const actions = element('div', 'actions');
    this.replay = button('Chơi lại', 'button primary', onReplay);
    actions.append(this.replay, button('Về menu', 'button secondary', onMenu));
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'true');
    this.card.setAttribute('aria-labelledby', title.id);
    this.card.append(title, summary, this.stats, this.best, this.next, actions);
    this.root.append(this.card);
    this.root.hidden = true;
  }

  show(result: RoundResult, previous?: number): void {
    cancelAnimationFrame(this.animation);
    const format = (value: number) => value.toLocaleString('vi-VN');
    this.rank.textContent = result.rank;
    this.rank.setAttribute('aria-label', `Hạng ${result.rank}`);
    this.stats.replaceChildren();
    for (const [label, value] of [
      ['Gián', format(result.kills)],
      ['Combo cao nhất', `×${result.maxCombo}`],
      ['Chính xác', `${Math.round(result.accuracy * 100)}%`],
    ]) {
      const group = element('div');
      group.append(element('dt', '', label), element('dd', '', value));
      this.stats.append(group);
    }

    const record = previous === undefined || result.score > previous;
    this.best.classList.toggle('new-record', record);
    this.best.textContent = record
      ? (previous === undefined ? 'Kỷ lục mới!' : `Kỷ lục mới! · Trước đó ${format(previous)}`)
      : `Kỷ lục cá nhân · ${format(previous)}`;
    this.next.hidden = !result.nextRank;
    this.next.textContent = result.nextRank
      ? `Cần ${format(result.nextRank.pointsNeeded)} điểm nữa để đạt hạng ${result.nextRank.rank}.`
      : '';
    this.root.hidden = false;
    this.replay.focus();

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.score.textContent = format(result.score);
      return;
    }

    this.score.textContent = '0';
    const startedAt = performance.now();
    const count = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 580);
      this.score.textContent = format(Math.round(result.score * (1 - (1 - progress) ** 3)));
      if (progress < 1) this.animation = requestAnimationFrame(count);
    };
    this.animation = requestAnimationFrame(count);
  }

  hide(): void {
    this.root.hidden = true;
    cancelAnimationFrame(this.animation);
  }
}
