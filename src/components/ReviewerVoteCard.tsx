import { useState, useEffect } from 'react';
import type { ReviewerVote, QualityCoeff } from '../lib/reviewers';
import { Chip } from '../ui';

const REVIEWER_AVATARS: Record<string, string> = {
  zhouming: '🧑‍🏫',
  yanzhi: '👨‍🔬',
  baihui: '👩‍🎓',
};

const COEFF_TONE: Record<QualityCoeff, 'spring' | 'gold' | 'danger' | ''> = {
  0.5: 'danger',
  1.0: '',
  2.0: 'gold',
};

const FRESH_DURATION_MS = 1200;

interface ReviewerVoteCardProps {
  vote: ReviewerVote;
  /** 是否刚收到（最近 1.2s 内）· 触发滑入 + 金光晕 */
  isFresh?: boolean;
}

/**
 * 已收到的审核员投票卡（Wave 2.5.A.4 升级版）
 *
 * Fresh 模式：从右滑入 + 金光晕 (cubic-bezier 弹回)
 * Static 模式：直接显示 · 无动画
 */
export function ReviewerVoteCard({ vote, isFresh = false }: ReviewerVoteCardProps) {
  // Fresh 状态短暂存在 · 1.2s 后清掉防止重复触发
  const [stillFresh, setStillFresh] = useState(isFresh);

  useEffect(() => {
    if (!isFresh) return;
    const timer = setTimeout(() => setStillFresh(false), FRESH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isFresh]);

  const animClass = stillFresh ? 'vote-card-fresh' : '';

  return (
    <div
      className={animClass}
      style={{
        display: 'flex',
        gap: 8,
        padding: '6px 8px',
        background: 'var(--paper-1)',
        border: '1px solid var(--wood-2)',
        marginBottom: 4,
        alignItems: 'flex-start',
        boxShadow: stillFresh
          ? '2px 2px 0 var(--wood-4)'
          : 'none',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          background: 'var(--paper-3)',
          border: '1px solid var(--wood-4)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {REVIEWER_AVATARS[vote.reviewerId] ?? '👤'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            className="t-title"
            style={{ fontSize: 11, color: 'var(--wood-3)' }}
          >
            {vote.reviewerName}
          </span>
          <Chip tone={COEFF_TONE[vote.coeff]}>x{vote.coeff.toFixed(1)}</Chip>
        </div>
        <div
          className="t-soft"
          style={{
            fontSize: 10,
            lineHeight: 1.5,
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
          }}
        >
          "{vote.comment}"
        </div>
      </div>
    </div>
  );
}

// CSS 注入（一次性）
let stylesInjected = false;
if (typeof document !== 'undefined' && !stylesInjected) {
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
@keyframes voteCardSlideIn {
  0% {
    transform: translateX(120%) rotate(8deg);
    opacity: 0;
  }
  60% {
    transform: translateX(-8px) rotate(-2deg);
    opacity: 1;
  }
  100% {
    transform: translateX(0) rotate(0);
    opacity: 1;
  }
}

@keyframes voteCardGlow {
  0% { box-shadow: 2px 2px 0 var(--wood-4), 0 0 0 0 var(--gold); }
  50% { box-shadow: 2px 2px 0 var(--wood-4), 0 0 24px 4px var(--gold); }
  100% { box-shadow: 2px 2px 0 var(--wood-4), 0 0 0 0 var(--gold); }
}

.vote-card-fresh {
  animation:
    voteCardSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
    voteCardGlow 1.2s ease-out;
}
`;
  document.head.appendChild(style);
}
