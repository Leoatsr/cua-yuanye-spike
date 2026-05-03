import type { ChatMessage } from '../lib/chatStore';
import { Sprite } from '../ui';

interface ChatMessageItemProps {
  message: ChatMessage;
  isMine: boolean;
}

/**
 * 单条消息渲染 · 像素古籍风
 *
 * 布局：
 *   [头像] [名字]    [时间]
 *          [消息内容]
 */
export function ChatMessageItem({ message, isMine }: ChatMessageItemProps) {
  const time = formatTime(message.created_at);

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* 头像 */}
      <div
        style={{
          width: 32,
          height: 32,
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          padding: 1,
          flexShrink: 0,
        }}
      >
        {message.sender_avatar ? (
          <img
            src={message.sender_avatar}
            alt={message.sender_name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <Sprite name="char" scale={1} />
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 名字 + 时间 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 2,
            gap: 6,
          }}
        >
          <span
            className="t-title"
            style={{
              fontSize: 12,
              color: isMine ? 'var(--gold)' : 'var(--wood-3)',
            }}
          >
            {message.sender_name}
            {isMine && <span style={{ marginLeft: 4, fontSize: 10 }}>· 你</span>}
          </span>
          <span
            className="t-faint mono"
            style={{ fontSize: 9, flexShrink: 0 }}
          >
            {time}
          </span>
        </div>
        {/* 消息体 */}
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--ink)',
            wordBreak: 'break-word',
            background: isMine ? 'var(--paper-2)' : 'transparent',
            padding: isMine ? '4px 8px' : '0',
            border: isMine ? '1px solid var(--wood-2)' : 'none',
          }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

/**
 * 时间格式化 — 5 分钟内显示"刚刚"，今日显示 HH:MM，昨天显示"昨天 HH:MM"，更早显示 MM-DD
 */
function formatTime(isoTime: string): string {
  const date = new Date(isoTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分前`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isYesterday) {
    return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
