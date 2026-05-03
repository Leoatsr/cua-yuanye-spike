import type { ReactNode } from 'react';
import { Sprite } from '../ui';

interface FriendItemProps {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  level?: number;
  levelName?: string;
  totalCV?: number;
  /** 右侧 action 按钮（如 "接受" "删除" "关注" "+" 等）*/
  actions?: ReactNode;
  /** 副标题（如 "想加你为好友" "已发送" 等）*/
  subtitle?: ReactNode;
}

/**
 * 通用好友/请求/关注/粉丝 单项
 */
export function FriendItem({
  displayName,
  username,
  avatarUrl,
  level,
  levelName,
  totalCV,
  actions,
  subtitle,
}: FriendItemProps) {
  return (
    <div
      style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid var(--paper-3)',
      }}
    >
      {/* 头像 */}
      <div
        style={{
          width: 36,
          height: 36,
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          padding: 1,
          flexShrink: 0,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
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

      {/* 信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span
            className="t-title"
            style={{
              fontSize: 13,
              color: 'var(--wood-3)',
            }}
          >
            {displayName}
          </span>
          <span className="t-faint mono" style={{ fontSize: 10 }}>
            @{username}
          </span>
        </div>
        {(level !== undefined || subtitle) && (
          <div
            className="t-soft"
            style={{
              fontSize: 10,
              marginTop: 2,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            {subtitle ||
              (level !== undefined && (
                <>
                  L{level} · {levelName}
                  {totalCV !== undefined && (
                    <span className="mono"> · CV {totalCV}</span>
                  )}
                </>
              ))}
          </div>
        )}
      </div>

      {/* 右侧 actions */}
      {actions && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{actions}</div>
      )}
    </div>
  );
}
