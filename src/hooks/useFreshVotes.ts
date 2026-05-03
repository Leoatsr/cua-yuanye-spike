import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { ReviewerVote } from '../lib/reviewers';

const FRESH_DURATION_MS = 1500;

/**
 * 监听 reviewer-vote-cast 事件 · 跟踪最近 1.5s 内的投票
 *
 * Wave 2.5.A.4
 *
 * 用 vote.votedAt 作为唯一 key（同一 reviewer 不会重复投票）
 *
 * Returns: Set<votedAt> · 在这个 set 里的 vote 应该播 fresh 动画
 */
export function useFreshVotes(enabled: boolean): Set<number> {
  const [freshSet, setFreshSet] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!enabled) return;

    const onVoteCast = (data: {
      submissionId: string;
      vote: ReviewerVote;
    }) => {
      const votedAt = data.vote.votedAt;
      setFreshSet((prev) => {
        const next = new Set(prev);
        next.add(votedAt);
        return next;
      });

      // 1.5s 后清掉
      setTimeout(() => {
        setFreshSet((prev) => {
          const next = new Set(prev);
          next.delete(votedAt);
          return next;
        });
      }, FRESH_DURATION_MS);
    };

    EventBus.on('reviewer-vote-cast', onVoteCast);
    return () => {
      EventBus.off('reviewer-vote-cast', onVoteCast);
    };
  }, [enabled]);

  return freshSet;
}
