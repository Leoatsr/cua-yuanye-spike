import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import {
  type Notification,
  NOTIFICATION_KIND_COLORS,
} from '../lib/notificationStore';

/**
 * D10 · Pack 4 · 右下角 toast
 *
 * - 收到通知 → 右下角弹 5 秒后自动消失
 * - 同时显示最多 3 个
 * - 点击 toast 关闭它
 * - 不取代 mail 系统（mail 是慢同步、长内容；这是即时短提醒）
 */

interface ToastEntry {
  id: string;
  notification: Notification;
  createdAt: number;
}

const TOAST_LIFETIME_MS = 5000;
const MAX_TOASTS = 3;

export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const onReceive = (n: Notification) => {
      setToasts((prev) => {
        const newToast: ToastEntry = {
          id: `toast-${n.id}-${Date.now()}`,
          notification: n,
          createdAt: Date.now(),
        };
        const next = [newToast, ...prev].slice(0, MAX_TOASTS);
        return next;
      });
    };
    EventBus.on('notification-received', onReceive);
    return () => {
      EventBus.off('notification-received', onReceive);
    };
  }, []);

  // Auto-expire
  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts((prev) =>
        prev.filter((t) => now - t.createdAt < TOAST_LIFETIME_MS)
      );
    }, 500);
    return () => clearInterval(interval);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 90,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 80,
        pointerEvents: 'none',
        maxWidth: 320,
      }}
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          notification={t.notification}
          onDismiss={() =>
            setToasts((prev) => prev.filter((x) => x.id !== t.id))
          }
        />
      ))}
    </div>
  );
}

function ToastCard({
  notification: n,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  const color = NOTIFICATION_KIND_COLORS[n.kind] ?? '#a8a08e';

  return (
    <div
      onClick={onDismiss}
      style={{
        pointerEvents: 'auto',
        background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
        border: `1px solid ${color}66`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: '10px 14px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
        color: '#f5f0e0',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        cursor: 'pointer',
        animation: 'toastIn 0.3s ease-out',
        maxWidth: 320,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          marginBottom: 3,
          letterSpacing: '0.02em',
        }}
      >
        {n.title}
      </div>
      {n.body && (
        <div
          style={{
            fontSize: 11,
            color: '#a8a08e',
            lineHeight: 1.5,
            marginBottom: 4,
          }}
        >
          {n.body}
        </div>
      )}
      <div
        style={{
          fontSize: 9,
          color: '#6e6856',
          letterSpacing: '0.05em',
        }}
      >
        点击关闭 · 5 秒自动消失
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
