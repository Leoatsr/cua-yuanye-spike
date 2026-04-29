import { useEffect } from 'react';
import { renderMarkdown } from '../lib/announcementsStore';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { Chip } from '../ui';

/**
 * NewAnnouncementPanel · 像素古籍风公告板
 *
 * 触发：5 图标 📜 EventBus 'toggle-panel' { panel: 'announcement' }
 *
 * 内容: announcements.md (来自 fetchAnnouncements) + 节气历史 (prependSolarTermNotice)
 * 已读 fingerprint: localStorage 'cua-yuanye-announcement-seen-v1'
 *
 * 注意：旧 AnnouncementButton 组件保留（左下圆形按钮也能开 · 但开的是新 panel · 因为旧的也是 toggle-panel 监听？）
 *      实际旧的不监听 EventBus · 所以新旧并存 · Wave 2.6 删旧的
 */

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 600;

export function NewAnnouncementPanel() {
  const [open, setOpen] = useOpenViaEventBus(
    'announcement',
    'open-announcement-panel',
  );
  const { markdown, loading, hasUnread, markRead } = useAnnouncements();

  // 打开时标记已读
  useEffect(() => {
    if (open) markRead();
  }, [open, markRead]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="bg-paper"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: PANEL_WIDTH,
        maxWidth: 'calc(100vw - 24px)',
        height: PANEL_HEIGHT,
        maxHeight: 'calc(100vh - 120px)',
        background: 'var(--paper-0)',
        border: '4px solid var(--wood-3)',
        boxShadow: '0 0 0 4px var(--wood-4), 8px 8px 0 rgba(0,0,0,0.2)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--f-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '3px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📜</span>
          <span className="t-title" style={{ fontSize: 18 }}>
            公告板
          </span>
          {hasUnread && <Chip tone="gold">新</Chip>}
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: 'var(--wood-3)',
            padding: 4,
            lineHeight: 1,
          }}
          title="关闭 (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Body · markdown 渲染 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          background: 'var(--paper-0)',
          fontSize: 14,
          lineHeight: 1.8,
          color: 'var(--ink)',
        }}
      >
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: 'var(--ink-faint)',
              fontSize: 13,
            }}
          >
            加载中...
          </div>
        ) : (
          <div className="announcement-content">
            {renderMarkdown(markdown)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '2px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--ink-faint)',
        }}
      >
        <span className="t-eyebrow">CUA 基地 · 公告 + 节气历史</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  );
}

export default NewAnnouncementPanel;
