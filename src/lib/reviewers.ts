/**
 * AI Reviewer system for CUA spike.
 *
 * When a player submits a task with a self-rated quality coefficient
 * (x0.5 / x1.0 / x2.0), 3 AI reviewers cast votes asynchronously.
 * Each reviewer has a personality that biases their voting tendency.
 *
 * C-6 just produces votes and emits events. C-7 will consume the votes
 * to compute CV credit and send result mail.
 */

import { EventBus } from '../game/EventBus';

export type QualityCoeff = 0.5 | 1.0 | 2.0;

/** A single vote from one reviewer. */
export interface ReviewerVote {
  reviewerId: 'zhouming' | 'yanzhi' | 'baihui';
  reviewerName: string;
  /** The quality coefficient this reviewer voted for */
  coeff: QualityCoeff;
  /** Short comment from the reviewer (predefined templates) */
  comment: string;
  /** ms timestamp when this vote landed */
  votedAt: number;
}

/** Reviewer personality affects voting behavior. */
interface ReviewerProfile {
  id: 'zhouming' | 'yanzhi' | 'baihui';
  name: string;
  /** ms range for vote delay — randomized within [min, max] */
  delayMin: number;
  delayMax: number;
  /**
   * Given the player's self-rated coefficient, return a weighted distribution
   * over what this reviewer is likely to actually vote.
   * Total weights need not sum to 1 — they're normalized by random pick.
   */
  voteFn: (selfRated: QualityCoeff) => Array<{ coeff: QualityCoeff; weight: number; commentTemplate: string }>;
}

const REVIEWERS: ReviewerProfile[] = [
  {
    id: 'zhouming',
    name: '周明',
    delayMin: 60_000,
    delayMax: 90_000,
    voteFn: (selfRated) => {
      // 周明：严谨、爱挑刺。倾向于打低自评。
      if (selfRated === 2.0) {
        return [
          { coeff: 1.0, weight: 7, commentTemplate: '架构图质量未达 x2.0 标准——但核心字段完整，给 x1.0。' },
          { coeff: 2.0, weight: 2, commentTemplate: '难得见到这种深度，符合 x2.0 标准。继续保持。' },
          { coeff: 0.5, weight: 1, commentTemplate: '自评偏高。流派标签存在争议，建议补正再提交。' },
        ];
      }
      if (selfRated === 1.0) {
        return [
          { coeff: 1.0, weight: 6, commentTemplate: '稳健交付，给 x1.0。' },
          { coeff: 0.5, weight: 3, commentTemplate: '核心字段有遗漏，按规范应给 x0.5。' },
          { coeff: 2.0, weight: 1, commentTemplate: '比预期好，加成 x2.0。' },
        ];
      }
      // selfRated === 0.5
      return [
        { coeff: 0.5, weight: 7, commentTemplate: '自评诚实，按 x0.5 通过。下次注意流派标签准确性。' },
        { coeff: 1.0, weight: 3, commentTemplate: '玩家自评偏严了，给 x1.0。' },
      ];
    },
  },
  {
    id: 'yanzhi',
    name: '严之',
    delayMin: 20_000,
    delayMax: 40_000,
    voteFn: (selfRated) => {
      // 严之：行动派，鼓励初尝试。倾向于抬高自评。
      if (selfRated === 0.5) {
        return [
          { coeff: 1.0, weight: 8, commentTemplate: '不要过分谦虚——这次完成度其实够 x1.0。下次更大胆点。' },
          { coeff: 0.5, weight: 2, commentTemplate: '自评准确。第一次能交就值得鼓励，按 x0.5 通过。' },
        ];
      }
      if (selfRated === 1.0) {
        return [
          { coeff: 1.0, weight: 5, commentTemplate: '完成度到位，x1.0 通过。' },
          { coeff: 2.0, weight: 4, commentTemplate: '细节做得不错，加成 x2.0。' },
          { coeff: 0.5, weight: 1, commentTemplate: '基础部分还需打磨——给 x0.5。' },
        ];
      }
      // selfRated === 2.0
      return [
        { coeff: 2.0, weight: 6, commentTemplate: '敢于自评 x2.0，且确实达到——继续这种主动性。' },
        { coeff: 1.0, weight: 4, commentTemplate: '部分细节未达 x2.0，但整体过关，给 x1.0。' },
      ];
    },
  },
  {
    id: 'baihui',
    name: '白徽',
    delayMin: 40_000,
    delayMax: 60_000,
    voteFn: (selfRated) => {
      // 白徽：中庸、给建议。最常见同意自评，偶尔小幅偏移。
      if (selfRated === 0.5) {
        return [
          { coeff: 0.5, weight: 5, commentTemplate: '同意 x0.5。建议下次重点关注流派打标准确性。' },
          { coeff: 1.0, weight: 5, commentTemplate: '完成度其实可达 x1.0——你低估了自己。' },
        ];
      }
      if (selfRated === 1.0) {
        return [
          { coeff: 1.0, weight: 7, commentTemplate: 'x1.0 通过。建议下次尝试补充隐藏 Repo 链接以争取 x2.0。' },
          { coeff: 0.5, weight: 1, commentTemplate: '部分字段需复核。' },
          { coeff: 2.0, weight: 2, commentTemplate: '细节出色，给 x2.0。' },
        ];
      }
      // selfRated === 2.0
      return [
        { coeff: 2.0, weight: 5, commentTemplate: '架构图质量上乘，符合 x2.0。' },
        { coeff: 1.0, weight: 5, commentTemplate: '主体完整但 x2.0 标准更严苛——给 x1.0。' },
      ];
    },
  },
];

/** Internal: pick a vote from weighted distribution. */
function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

/** Random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Schedule 3 reviewer votes for a submitted task.
 * Each vote is dispatched via EventBus when its timer fires.
 *
 * @param submissionId — unique id for this submission (taskId + timestamp)
 * @param selfRated — player's self-rated quality coefficient
 * @returns a list of "scheduled" descriptors (so we can compute deadlines for offline catch-up)
 */
export interface ScheduledVote {
  reviewerId: 'zhouming' | 'yanzhi' | 'baihui';
  /** ms timestamp when this vote will land */
  votesAt: number;
}

/**
 * Module-level registry of pending vote timers — keyed by submissionId.
 * Used by cancelScheduledVotes() to cancel pending votes when a player
 * withdraws their submission (D5 / withdraw window).
 */
const pendingTimers: Record<string, ReturnType<typeof setTimeout>[]> = {};

export function scheduleReviewerVotes(
  submissionId: string,
  selfRated: QualityCoeff,
  options: { skipTimers?: boolean } = {}
): ScheduledVote[] {
  const scheduled: ScheduledVote[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];

  REVIEWERS.forEach((reviewer) => {
    const delay = randInt(reviewer.delayMin, reviewer.delayMax);
    const votesAt = Date.now() + delay;
    scheduled.push({ reviewerId: reviewer.id, votesAt });

    if (options.skipTimers) return;

    const timerId = setTimeout(() => {
      castVote(submissionId, reviewer, selfRated);
    }, delay);
    timers.push(timerId);
  });

  if (timers.length > 0) {
    pendingTimers[submissionId] = timers;
  }

  return scheduled;
}

/**
 * Cancel all pending vote timers for a submission.
 * Called when the player withdraws their submission within the withdraw window.
 *
 * Note: votes already cast (i.e. their setTimeout already fired and emitted
 * 'reviewer-vote-cast') cannot be undone here — they're already in QuestLog state.
 * The caller is responsible for clearing those from quest state separately.
 */
export function cancelScheduledVotes(submissionId: string): number {
  const timers = pendingTimers[submissionId];
  if (!timers) return 0;
  timers.forEach((t) => clearTimeout(t));
  delete pendingTimers[submissionId];
  return timers.length;
}

/** Cast a single vote — pick from weighted distribution and emit via EventBus. */
function castVote(submissionId: string, reviewer: ReviewerProfile, selfRated: QualityCoeff): void {
  const distribution = reviewer.voteFn(selfRated);
  const picked = pickWeighted(distribution);

  const vote: ReviewerVote = {
    reviewerId: reviewer.id,
    reviewerName: reviewer.name,
    coeff: picked.coeff,
    comment: picked.commentTemplate,
    votedAt: Date.now(),
  };

  EventBus.emit('reviewer-vote-cast', { submissionId, vote });
}

/**
 * Catch-up: when the game starts, scan all submissions that are still
 * 'reviewing' and check if their scheduled votes have passed. If so,
 * dispatch them immediately so the player sees results from offline time.
 *
 * Called by QuestLog on mount.
 */
export function catchUpPendingVotes(
  submissions: Array<{
    submissionId: string;
    selfRated: QualityCoeff;
    scheduledVotes: ScheduledVote[];
    receivedVoteIds: Array<'zhouming' | 'yanzhi' | 'baihui'>;
  }>
): void {
  const now = Date.now();
  for (const sub of submissions) {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const sched of sub.scheduledVotes) {
      // Already received?
      if (sub.receivedVoteIds.includes(sched.reviewerId)) continue;
      // Should have fired by now?
      if (sched.votesAt > now) {
        // Future — re-schedule with the remaining delay
        const remaining = sched.votesAt - now;
        const reviewer = REVIEWERS.find((r) => r.id === sched.reviewerId);
        if (reviewer) {
          const timerId = setTimeout(() => castVote(sub.submissionId, reviewer, sub.selfRated), remaining);
          timers.push(timerId);
        }
      } else {
        // Past — fire now
        const reviewer = REVIEWERS.find((r) => r.id === sched.reviewerId);
        if (reviewer) castVote(sub.submissionId, reviewer, sub.selfRated);
      }
    }
    if (timers.length > 0) {
      pendingTimers[sub.submissionId] = [...(pendingTimers[sub.submissionId] ?? []), ...timers];
    }
  }
}

/** Public: get reviewer display info for UI. */
export function getReviewerName(id: 'zhouming' | 'yanzhi' | 'baihui'): string {
  return REVIEWERS.find((r) => r.id === id)?.name ?? id;
}
