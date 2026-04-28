/**
 * Appeal reviewer system — separate pool of 3 reviewers used only for appeals.
 *
 * The original 3 reviewers (周明 / 严之 / 白徽) cannot review the same submission
 * twice. When the player appeals a finalized verdict, this module schedules
 * votes from a different trio: 谢忱 / 黎明 / 苏砚.
 *
 * The personalities are tuned slightly differently from the originals:
 * - 谢忱 (xie-chen): senior fair-minded reviewer, mostly votes the median
 * - 黎明 (li-ming): encouraging reviewer, slightly biased upward (gives players
 *   a second chance)
 * - 苏砚 (su-yan): rigorous scholar, similar to 周明 but cooler-headed
 */

import { EventBus } from '../game/EventBus';

export type QualityCoeff = 0.5 | 1.0 | 2.0;

export interface AppealReviewerVote {
  reviewerId: 'xiechen' | 'liming' | 'suyan';
  reviewerName: string;
  coeff: QualityCoeff;
  comment: string;
  votedAt: number;
}

interface AppealReviewerProfile {
  id: 'xiechen' | 'liming' | 'suyan';
  name: string;
  delayMin: number;
  delayMax: number;
  voteFn: (selfRated: QualityCoeff, originalCoeff: QualityCoeff) =>
    Array<{ coeff: QualityCoeff; weight: number; commentTemplate: string }>;
}

const APPEAL_REVIEWERS: AppealReviewerProfile[] = [
  {
    id: 'xiechen',
    name: '谢忱',
    delayMin: 50_000,
    delayMax: 80_000,
    voteFn: (selfRated, originalCoeff) => {
      // 谢忱: 公正中庸 — 多数投合理值，偶尔偏向自评
      if (selfRated === 2.0 && originalCoeff < 2.0) {
        // Player thinks 2.0 but original gave less — 谢忱 weighs evidence
        return [
          { coeff: 2.0, weight: 4, commentTemplate: '复审认为本提交确实达到 x2.0 标准。原审核可能过严。' },
          { coeff: 1.0, weight: 4, commentTemplate: '维持原审 x1.0。质量稳定但未达 x2.0 高标准。' },
          { coeff: 0.5, weight: 2, commentTemplate: '细查后发现疑点——给 x0.5。' },
        ];
      }
      if (selfRated === 1.0 && originalCoeff < 1.0) {
        return [
          { coeff: 1.0, weight: 6, commentTemplate: '复审认为达到 x1.0 标准。' },
          { coeff: 0.5, weight: 4, commentTemplate: '维持 x0.5——核心字段确有遗漏。' },
        ];
      }
      // selfRated <= originalCoeff: probably OK, just confirming
      return [
        { coeff: originalCoeff, weight: 6, commentTemplate: '复审维持原系数。原审核到位。' },
        { coeff: Math.min(2.0, originalCoeff + 0.5) as QualityCoeff, weight: 2, commentTemplate: '复审稍有上调空间。' },
        { coeff: Math.max(0.5, originalCoeff - 0.5) as QualityCoeff, weight: 2, commentTemplate: '复审觉得原审核还偏宽。' },
      ];
    },
  },
  {
    id: 'liming',
    name: '黎明',
    delayMin: 25_000,
    delayMax: 55_000,
    voteFn: (selfRated, originalCoeff) => {
      // 黎明: 鼓励派 — 申诉的玩家是主动求公正的，给好意
      if (selfRated > originalCoeff) {
        return [
          { coeff: selfRated, weight: 6, commentTemplate: '愿意为自己发声的人值得鼓励。复审赞同你的自评。' },
          { coeff: originalCoeff, weight: 3, commentTemplate: '虽然申诉的勇气可嘉，复审还是维持原系数。' },
          { coeff: Math.min(2.0, selfRated + 0.5) as QualityCoeff, weight: 1, commentTemplate: '细看后发现还有惊喜——上调一档。' },
        ];
      }
      // selfRated <= originalCoeff: 黎明 maintains
      return [
        { coeff: originalCoeff, weight: 7, commentTemplate: '复审维持原审核——原审核员的判断准确。' },
        { coeff: Math.min(2.0, originalCoeff + 0.5) as QualityCoeff, weight: 3, commentTemplate: '小细节加成——上调一档。' },
      ];
    },
  },
  {
    id: 'suyan',
    name: '苏砚',
    delayMin: 60_000,
    delayMax: 85_000,
    voteFn: (selfRated, originalCoeff) => {
      // 苏砚: 学术严谨 — 比周明冷静，但同样严
      if (selfRated > originalCoeff) {
        return [
          { coeff: originalCoeff, weight: 7, commentTemplate: '复审仔细对照规范——原审核合理。维持。' },
          { coeff: selfRated, weight: 2, commentTemplate: '复审同意自评。原审核员可能漏看了某些细节。' },
          { coeff: Math.max(0.5, originalCoeff - 0.5) as QualityCoeff, weight: 1, commentTemplate: '严格按规范——比原审核还要再降一档。' },
        ];
      }
      return [
        { coeff: originalCoeff, weight: 8, commentTemplate: '严格复审——原审核合规。' },
        { coeff: Math.max(0.5, originalCoeff - 0.5) as QualityCoeff, weight: 2, commentTemplate: '细查后发现微小问题——降一档更准。' },
      ];
    },
  },
];

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface AppealScheduledVote {
  reviewerId: 'xiechen' | 'liming' | 'suyan';
  votesAt: number;
}

/**
 * Schedule 3 appeal reviewer votes for a re-submitted task.
 */
export function scheduleAppealVotes(
  appealId: string,
  selfRated: QualityCoeff,
  originalCoeff: QualityCoeff,
  options: { skipTimers?: boolean } = {}
): AppealScheduledVote[] {
  const scheduled: AppealScheduledVote[] = [];

  APPEAL_REVIEWERS.forEach((reviewer) => {
    const delay = randInt(reviewer.delayMin, reviewer.delayMax);
    const votesAt = Date.now() + delay;
    scheduled.push({ reviewerId: reviewer.id, votesAt });

    if (options.skipTimers) return;

    setTimeout(() => {
      castAppealVote(appealId, reviewer, selfRated, originalCoeff);
    }, delay);
  });

  return scheduled;
}

function castAppealVote(
  appealId: string,
  reviewer: AppealReviewerProfile,
  selfRated: QualityCoeff,
  originalCoeff: QualityCoeff,
): void {
  const distribution = reviewer.voteFn(selfRated, originalCoeff);
  const picked = pickWeighted(distribution);

  const vote: AppealReviewerVote = {
    reviewerId: reviewer.id,
    reviewerName: reviewer.name,
    coeff: picked.coeff,
    comment: picked.commentTemplate,
    votedAt: Date.now(),
  };

  EventBus.emit('appeal-vote-cast', { appealId, vote });
}

/**
 * Catch up appeal votes that were scheduled before page reload.
 */
export function catchUpAppealVotes(
  appeals: Array<{
    appealId: string;
    selfRated: QualityCoeff;
    originalCoeff: QualityCoeff;
    scheduledVotes: AppealScheduledVote[];
    receivedVoteIds: Array<'xiechen' | 'liming' | 'suyan'>;
  }>
): void {
  const now = Date.now();
  for (const ap of appeals) {
    for (const sched of ap.scheduledVotes) {
      if (ap.receivedVoteIds.includes(sched.reviewerId)) continue;
      const reviewer = APPEAL_REVIEWERS.find((r) => r.id === sched.reviewerId);
      if (!reviewer) continue;
      if (sched.votesAt > now) {
        const remaining = sched.votesAt - now;
        setTimeout(() => castAppealVote(ap.appealId, reviewer, ap.selfRated, ap.originalCoeff), remaining);
      } else {
        castAppealVote(ap.appealId, reviewer, ap.selfRated, ap.originalCoeff);
      }
    }
  }
}
