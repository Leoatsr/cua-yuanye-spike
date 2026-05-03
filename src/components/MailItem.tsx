import type { Mail } from '../lib/mail';

interface MailItemProps {
  mail: Mail;
  active: boolean;
  onClick: () => void;
}

const CATEGORY_ICONS: Record<Mail['category'], string> = {
  system: '🔔',
  review: '⚖',
  verdict: '📜',
  appeal: '🚨',
  cv: '🏆',
};

const CATEGORY_LABELS: Record<Mail['category'], string> = {
  system: '系统',
  review: '审核',
  verdict: '裁定',
  appeal: '申诉',
  cv: 'CV',
};

/**
 * 邮件 sidebar 单项 — 图标 + 主题 + 时间 + 未读小红点
 */
export function MailItem({ mail, active, onClick }: MailItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '10px 12px',
        background: active
          ? 'var(--paper-2)'
          : mail.read
          ? 'transparent'
          : 'rgba(218, 165, 32, 0.08)',
        border: 'none',
        borderBottom: '1px solid var(--paper-3)',
        borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
        cursor: 'pointer',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        textAlign: 'left',
        fontFamily: 'var(--f-sans)',
        position: 'relative',
        transition: 'all 0.15s',
      }}
    >
      {/* 图标 */}
      <div
        style={{
          width: 28,
          height: 28,
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {CATEGORY_ICONS[mail.category]}
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            className="t-eyebrow"
            style={{
              fontSize: 9,
              color: 'var(--wood-3)',
            }}
          >
            {CATEGORY_LABELS[mail.category]}
          </span>
          {!mail.read && (
            <span
              style={{
                width: 6,
                height: 6,
                background: 'var(--gold)',
                border: '1px solid var(--wood-4)',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
          )}
        </div>
        <div
          className="t-title"
          style={{
            fontSize: 12,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: mail.read ? 400 : 600,
          }}
        >
          {mail.subject}
        </div>
        <div
          className="t-faint"
          style={{
            fontSize: 10,
            marginTop: 2,
          }}
        >
          {formatRelativeTime(mail.sentAt)}
        </div>
      </div>
    </button>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const date = new Date(timestamp);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}
