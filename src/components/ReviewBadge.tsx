import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { getReviewTasks, isReviewSeeded } from '../lib/reviewerPool';

/**
 * Bottom-left badge showing pending review count.
 * Sits next to the MailBadge.
 * Hidden until the player has been seeded with at least one review.
 */
export function ReviewBadge() {
  const [pending, setPending] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(() => isReviewSeeded());

  const refresh = () => {
    setPending(getReviewTasks().filter((t) => t.status === 'pending').length);
    setVisible(isReviewSeeded());
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1500);

    const onMailReceived = () => refresh();
    EventBus.on('mail-received', onMailReceived);

    return () => {
      clearInterval(interval);
      EventBus.off('mail-received', onMailReceived);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      onClick={() => EventBus.emit('open-review-panel')}
      title="点击打开审核面板"
      style={{
        position: 'fixed',
        bottom: 60,
        left: 150,             // sits to the right of MailBadge
        zIndex: 50,
        background: 'rgba(20, 20, 30, 0.85)',
        padding: '8px 12px',
        borderRadius: 6,
        border: pending > 0
          ? '1px solid rgba(224, 176, 96, 0.5)'
          : '1px solid rgba(127, 160, 192, 0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(4px)',
        userSelect: 'none',
        transition: 'all 0.2s',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(35, 35, 45, 0.95)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(20, 20, 30, 0.85)';
      }}
    >
      <span style={{ fontSize: 14 }}>🎖️</span>
      <span
        style={{
          fontSize: 11,
          color: pending > 0 ? '#e0b060' : '#a8b3a0',
          letterSpacing: '0.05em',
          fontWeight: pending > 0 ? 600 : 400,
        }}
      >
        {pending > 0 ? `${pending} 项待审核` : '审核面板'}
      </span>
    </div>
  );
}
