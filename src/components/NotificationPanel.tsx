import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventBus } from '../game/EventBus';
import {
  notificationManager,
  type Notification,
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KIND_COLORS,
} from '../lib/notificationStore';

/**
 * D10 · Pack 4 · 完整通知列表面板
 *
 * 触发：N 键
 * 可：标记已读 / 全部已读 / 跳转 link
 */
export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    EventBus.on('open-notifications', onOpen);
    return () => {
      EventBus.off('open-notifications', onOpen);
    };
  }, []);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Load on open / filter change / new notif arrived
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const list = await notificationManager.fetchRecent(
        80,
        filter === 'unread'
      );
      if (!cancelled) {
        setNotifications(list);
        setLoading(false);
      }
    };
    void load();
    const onNew = () => {
      if (!cancelled) void load();
    };
    EventBus.on('notification-received', onNew);
    return () => {
      cancelled = true;
      EventBus.off('notification-received', onNew);
    };
  }, [open, filter]);

  const handleMarkAllRead = async () => {
    await notificationManager.markRead(null);
    const list = await notificationManager.fetchRecent(
      80,
      filter === 'unread'
    );
    setNotifications(list);
  };

  const handleClickItem = async (n: Notification) => {
    if (!n.read_at) {
      await notificationManager.markRead([n.id]);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      );
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 99,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, 92vw)',
          maxHeight: '85vh',
          background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
          border: '1px solid rgba(184, 137, 58, 0.5)',
          borderRadius: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          color: '#f5f0e0',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 10px',
            borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
            background: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: '#8a8576',
                letterSpacing: '0.15em',
                marginBottom: 2,
              }}
            >
              NOTIFICATIONS · D10
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#e0b060' }}>
              通知中心
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 12,
                    color: '#e07a6e',
                    fontWeight: 400,
                  }}
                >
                  {unreadCount} 未读
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              background: 'transparent',
              border: '1px solid rgba(168, 179, 160, 0.3)',
              borderRadius: 3,
              color: '#a8a08e',
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
            }}
          >
            关闭 ESC
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 18px',
            background: 'rgba(0,0,0,0.18)',
            borderBottom: '1px solid rgba(184, 137, 58, 0.15)',
            fontSize: 11,
            alignItems: 'center',
          }}
        >
          <FilterChip
            label="全部"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label="仅未读"
            active={filter === 'unread'}
            onClick={() => setFilter('unread')}
          />
          {unreadCount > 0 && (
            <button
              onClick={() => void handleMarkAllRead()}
              style={{
                marginLeft: 'auto',
                padding: '3px 10px',
                background: 'rgba(127, 192, 144, 0.15)',
                border: '1px solid rgba(127, 192, 144, 0.4)',
                borderRadius: 3,
                color: '#7fc090',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.05em',
              }}
            >
              全部标为已读
            </button>
          )}
        </div>

        {/* List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px 0',
          }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
              载入中...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
              {filter === 'unread' ? '— 没有未读通知 —' : '— 暂无通知 —'}
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationRow key={n.id} n={n} onClick={() => void handleClickItem(n)} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '3px 12px',
        cursor: 'pointer',
        borderRadius: 3,
        background: active ? 'rgba(224, 176, 96, 0.18)' : 'rgba(168, 179, 160, 0.05)',
        color: active ? '#e0b060' : '#a8a08e',
        border: `1px solid ${active ? 'rgba(224, 176, 96, 0.5)' : 'rgba(168, 179, 160, 0.15)'}`,
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  );
}

function NotificationRow({
  n,
  onClick,
}: {
  n: Notification;
  onClick: () => void;
}) {
  const color = NOTIFICATION_KIND_COLORS[n.kind] ?? '#a8a08e';
  const label = NOTIFICATION_KIND_LABELS[n.kind] ?? n.kind;
  const t = new Date(n.created_at);
  const now = new Date();
  const diffMs = now.getTime() - t.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  const ago =
    diffMin < 1 ? '刚刚' :
    diffMin < 60 ? `${diffMin}分钟前` :
    diffHour < 24 ? `${diffHour}小时前` :
    diffDay < 7 ? `${diffDay}天前` :
    `${t.getMonth() + 1}-${t.getDate()}`;

  const unread = !n.read_at;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 18px',
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
        cursor: 'pointer',
        background: unread ? 'rgba(224, 176, 96, 0.04)' : 'transparent',
        transition: 'background 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'rgba(184, 137, 58, 0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = unread
          ? 'rgba(224, 176, 96, 0.04)'
          : 'transparent';
      }}
    >
      {unread && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#e07a6e',
            boxShadow: '0 0 4px #e07a6e',
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color,
            background: `${color}22`,
            border: `1px solid ${color}55`,
            padding: '1px 7px',
            borderRadius: 2,
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: '#f5f0e0', fontWeight: unread ? 600 : 400 }}>
          {n.title}
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#6e6856',
            fontFamily: 'monospace',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {ago}
        </span>
      </div>
      {n.body && (
        <div
          style={{
            fontSize: 11,
            color: '#a8a08e',
            lineHeight: 1.6,
            paddingLeft: 4,
          }}
        >
          {n.body}
        </div>
      )}
    </div>
  );
}
