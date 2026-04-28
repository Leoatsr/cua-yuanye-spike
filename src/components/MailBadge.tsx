import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { getUnreadCount } from '../lib/mail';

/**
 * Bottom-left badge showing unread mail count.
 * Click to open the mailbox (same as pressing K).
 * Sits next to the citizen badge / titles row.
 */
export function MailBadge() {
  const [unread, setUnread] = useState<number>(() => getUnreadCount());
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const next = getUnreadCount();
      setUnread((prev) => {
        // If a new mail arrived, pulse
        if (next > prev) {
          setPulse(true);
          setTimeout(() => setPulse(false), 2000);
        }
        return next;
      });
    };

    EventBus.on('mail-received', refresh);
    EventBus.on('mailbox-state-changed', refresh);

    // Also refresh when mailbox closes (mails may have been read/deleted)
    const interval = setInterval(refresh, 1000);

    return () => {
      EventBus.off('mail-received', refresh);
      EventBus.off('mailbox-state-changed', refresh);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      onClick={() => EventBus.emit('open-mailbox')}
      title="按 K 打开收件箱"
      style={{
        position: 'fixed',
        bottom: 60,  // sits above the citizen badge / titles row
        left: 16,
        zIndex: 50,
        background: 'rgba(20, 20, 30, 0.85)',
        padding: '8px 12px',
        borderRadius: 6,
        border: unread > 0
          ? '1px solid rgba(255, 215, 0, 0.5)'
          : '1px solid rgba(127, 160, 192, 0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(4px)',
        userSelect: 'none',
        animation: pulse ? 'mailPulse 2s ease-out' : 'none',
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
      <span style={{ fontSize: 16 }}>📬</span>
      <span
        style={{
          fontSize: 11,
          color: unread > 0 ? '#FFD700' : '#a8b3a0',
          letterSpacing: '0.05em',
          fontWeight: unread > 0 ? 600 : 400,
        }}
      >
        {unread > 0 ? `${unread} 封未读` : '收件箱'}
      </span>
      <style>{`
        @keyframes mailPulse {
          0%   { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
          100% { box-shadow: 0 0 0 14px rgba(255, 215, 0, 0); }
        }
      `}</style>
    </div>
  );
}
