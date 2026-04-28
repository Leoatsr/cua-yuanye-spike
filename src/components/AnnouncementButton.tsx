import { useEffect, useState } from 'react';
import { fetchAnnouncements, renderMarkdown, prependSolarTermNotice } from '../lib/announcementsStore';

/**
 * 公告板按钮 + 弹窗
 *
 * 屏幕左下角 📜 按钮 → 点击弹窗显示 announcements.md 内容
 *
 * 替代物理"萌芽镇入口石碑"——作为 React DOM overlay 任何 scene 都能用
 */

const SEEN_KEY = 'cua-yuanye-announcement-seen-v1';

export function AnnouncementButton() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // 加载公告 + 检查是否新
  useEffect(() => {
    let cancelled = false;
    void fetchAnnouncements().then((md) => {
      if (cancelled) return;
      setContent(md);
      // 用 md 内容长度做简单 fingerprint
      const fingerprint = md.length.toString() + md.slice(0, 50);
      const seen = localStorage.getItem(SEEN_KEY);
      setHasUnread(seen !== fingerprint);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ESC 关闭
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

  const handleOpen = async () => {
    setLoading(true);
    if (!content) {
      const md = await fetchAnnouncements();
      setContent(md);
      const fingerprint = md.length.toString() + md.slice(0, 50);
      localStorage.setItem(SEEN_KEY, fingerprint);
    } else {
      const fingerprint = content.length.toString() + content.slice(0, 50);
      localStorage.setItem(SEEN_KEY, fingerprint);
    }
    setHasUnread(false);
    setOpen(true);
    setLoading(false);
  };

  return (
    <>
      {/* Trigger button (left bottom) */}
      <div
        onClick={() => void handleOpen()}
        title="公告"
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(20, 24, 30, 0.85)',
          border: open
            ? '1px solid rgba(224, 176, 96, 0.7)'
            : '1px solid rgba(168, 179, 160, 0.3)',
          boxShadow: open
            ? '0 0 12px rgba(224, 176, 96, 0.4)'
            : '0 4px 12px rgba(0,0,0,0.4)',
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          zIndex: 50,
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
        📜
        {/* Unread red dot */}
        {hasUnread && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#e07a6e',
              border: '2px solid #15171f',
              animation: 'pulse 2s infinite',
            }}
          />
        )}
        <style>
          {`@keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }`}
        </style>
      </div>

      {/* Modal */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
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
              width: 'min(640px, 92vw)',
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
                  ANNOUNCEMENT
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#e0b060' }}>
                  📜 公告板
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

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '20px 24px 28px',
              }}
            >
              {content ? (
                <div>{renderMarkdown(prependSolarTermNotice(content))}</div>
              ) : (
                <div
                  style={{
                    padding: 60,
                    textAlign: 'center',
                    color: '#8a8576',
                    fontStyle: 'italic',
                  }}
                >
                  载入中...
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
