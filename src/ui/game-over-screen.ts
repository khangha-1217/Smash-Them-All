import type { AchievementId } from '../core/achievement-tracker';
import type { RoundResult } from '../core/types';
import type { I18n } from '../i18n/i18n';
import { button, copy, element, translateCopy } from './dom';
import { badgeCard } from './trophy-cabinet';

export class GameOverScreen {
  readonly root = element('section', 'modal-overlay results-overlay');
  private readonly card = element('div', 'card results-card');
  private readonly score = element('strong', 'result-score');
  private readonly rank = element('span', 'rank-stamp');
  private readonly stats = element('dl', 'results-stats');
  private readonly best = element('p', 'personal-best');
  private readonly next = element('p', 'next-rank');
  private readonly achievements = element('section', 'result-achievements');
  private readonly badges = element('ul', 'badge-grid');
  private readonly title = copy(element('h2'), 'results.title');
  private animation = 0;
  private displayedScore = 0;
  private completed?: { result: RoundResult; previous: number | undefined; newlyUnlocked: readonly AchievementId[] };

  constructor(private readonly i18n: I18n, onReplay: () => void, onMenu: () => void) {
    const { title } = this;
    title.id = 'results-title';
    title.tabIndex = -1;
    const summary = element('div', 'result-summary');
    const scoreGroup = element('div');
    scoreGroup.append(copy(element('span', 'selector-label'), 'results.score'), this.score);
    summary.append(scoreGroup, this.rank);

    const actions = element('div', 'actions');
    actions.append(
      copy(button('', 'button primary', onReplay), 'results.replay'),
      copy(button('', 'button secondary', onMenu), 'menu.back'),
    );
    this.achievements.append(copy(element('h3'), 'results.achievements'), this.badges);
    this.card.setAttribute('role', 'dialog');
    this.card.setAttribute('aria-modal', 'true');
    this.card.setAttribute('aria-labelledby', title.id);
    this.card.append(title, summary, this.stats, this.best, this.next, this.achievements, actions);
    this.root.append(this.card);
    this.root.hidden = true;
  }

  show(result: RoundResult, previous: number | undefined, newlyUnlocked: readonly AchievementId[]): void {
    cancelAnimationFrame(this.animation);
    this.completed = { result, previous, newlyUnlocked };
    this.root.hidden = false;
    this.root.scrollTop = 0;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.displayedScore = reduceMotion ? result.score : 0;
    this.localize();
    this.title.focus({ preventScroll: true });
    if (reduceMotion) return;

    const startedAt = performance.now();
    const count = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 580);
      this.displayedScore = Math.round(result.score * (1 - (1 - progress) ** 3));
      this.score.textContent = this.i18n.number(this.displayedScore);
      if (progress < 1) this.animation = requestAnimationFrame(count);
    };
    this.animation = requestAnimationFrame(count);
  }

  localize(): void {
    if (!this.completed) return;
    const { result, previous, newlyUnlocked } = this.completed;
    const { i18n } = this;
    translateCopy(this.root, i18n);
    this.score.textContent = i18n.number(this.displayedScore);
    this.rank.textContent = result.rank;
    this.rank.setAttribute('aria-label', i18n.t('results.rank', { rank: result.rank }));
    this.stats.replaceChildren();
    for (const [label, value] of [
      [i18n.t('hud.kills'), i18n.number(result.kills)],
      [i18n.t('results.combo'), i18n.t('results.comboValue', { multiplier: result.maxCombo })],
      [i18n.t('results.accuracy'), i18n.t('results.accuracyValue', { percent: Math.round(result.accuracy * 100) })],
    ]) {
      const group = element('div');
      group.append(element('dt', '', label), element('dd', '', value));
      this.stats.append(group);
    }

    const record = previous === undefined || result.score > previous;
    this.best.classList.toggle('new-record', record);
    this.best.textContent = previous === undefined
      ? i18n.t('results.newBest')
      : i18n.t(record ? 'results.previousBest' : 'results.personalBest', { score: i18n.number(previous) });
    this.next.hidden = !result.nextRank;
    this.next.textContent = result.nextRank
      ? i18n.t('results.nextRank', { points: i18n.number(result.nextRank.pointsNeeded), rank: result.nextRank.rank })
      : '';
    this.achievements.hidden = newlyUnlocked.length === 0;
    this.badges.replaceChildren(...newlyUnlocked.map(id => badgeCard(i18n, id, true)));
  }

  hide(): void {
    this.root.hidden = true;
    this.completed = undefined;
    cancelAnimationFrame(this.animation);
  }
}
