import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { notificationManager } from '../lib/notificationStore';

/**
 * D10 · 顶部小红点 + 点击打开 N 面板
 *
 * 位置：右上角附近的现有 HUD 旁边（top:16, right:16 附近）
 * 当前布局已被占用 (Webagentlab/任务/我的主页/活跃贡献者)
 * 我放在 top:50, right:16 — 等级胸章下方
 */
export function NotificationBadge() {
  const [unread, setUnread] = useState(0);
  const [logined, setLogined] = useState(false);

  // 启动 realtime 订阅 + 拉初始未读数
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const count = await notificationManager.countUnread();
      if (cancelled) return;
      // 如果 count > 0，可以认为登录了；额外逻辑可改进
      setLogined(count >= 0);
      setUnread(count);
      await notificationManager.subscribe();
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // 收到新通知 → +1
  useEffect(() => {
    const onNew = () => {
      setUnread((u) => u + 1);
    };
    const onMarkRead = (data: { ids: string[] | null; count: number }) => {
      if (data.ids === null) {
        setUnread(0);
      } else {
        setUnread((u) => Math.max(0, u - data.count));
      }
    };
    EventBus.on('notification-received', onNew);
    EventBus.on('notifications-marked-read', onMarkRead);
    return () => {
      EventBus.off('notification-received', onNew);
      EventBus.off('notifications-marked-read', onMarkRead);
    };
  }, []);

  if (!logined) return null;

  const handleClick = () => {
    EventBus.emit('open-notifications');
  };

  return (
    <div
      onClick={handleClick}
      title="通知中心 (N)"
      style={{
        position: 'fixed',
        top: 50,
        right: 16,
        zIndex: 50,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(20, 24, 30, 0.85)',
        border: `1px solid ${unread > 0 ? 'rgba(224, 122, 110, 0.6)' : 'rgba(168, 179, 160, 0.3)'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        transition: 'all 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
      }}
    >
      🔔
      {unread > 0 && (
        <div
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            background: '#e07a6e',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #14161e',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </div>
      )}
    </div>
  );
}
