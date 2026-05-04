import type { ReactNode } from 'react';
import { Sprite } from '../ui';

interface FriendItemProps {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  level?: number;
  levelName?: string;
  totalCV?: number;
  /** 右侧 action 按钮 (如 "接受" "删除" "关注" "+" 等) */
  actions?: ReactNode;
  /** 副标题 (如 "想加你为好友" "已发送" 等) */
  subtitle?: ReactNode;
  /** 在线状态 · undefined 表示不显示状态 (例如请求页) */
  isOnline?: boolean;
}

/**
 * 通用好友/请求/关注/粉丝 单项
 *
 * 在线状态显示:
 *   - 头像右下角小圆点 (绿 = 在线 · 灰 = 离线)
 *   - 名字旁文字标签 ([在线] / [离线])
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
  isOnline,
}: FriendItemProps) {
  const showOnlineStatus = isOnline !== undefined;

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
      {/* 头像 + 状态点 */}
      <div
        style={{
          width: 36,
          height: 36,
          background: 'var(--paper-3)',
          border: '2px solid var(--wood-4)',
          padding: 1,
          flexShrink: 0,
          position: 'relative',
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

        {/* 状态点 · 头像右下角 */}
        {showOnlineStatus && (
          <div
            style={{
              position: 'absolute',
              right: -3,
              bottom: -3,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isOnline ? '#3bd16f' : '#9a9489',
              border: '2px solid var(--paper-0)',
              boxShadow: isOnline ? '0 0 4px rgba(59,209,111,0.6)' : 'none',
            }}
            title={isOnline ? '在线' : '离线'}
          />
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

          {/* 在线/离线 文字标签 */}
          {showOnlineStatus && (
            <span
              className="mono"
              style={{
                fontSize: 9,
                padding: '1px 5px',
                background: isOnline
                  ? 'rgba(59,209,111,0.15)'
                  : 'rgba(154,148,137,0.15)',
                color: isOnline ? '#2a9750' : '#8a8576',
                border: `1px solid ${isOnline ? '#3bd16f' : '#9a9489'}`,
                borderRadius: 2,
                lineHeight: 1.4,
              }}
            >
              {isOnline ? '在线' : '离线'}
            </span>
          )}
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
