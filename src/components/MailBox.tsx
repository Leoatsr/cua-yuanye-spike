import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { Mail, MailCategory } from '../lib/mail';
import {
  getAllMails,
  markAsRead,
  deleteMail,
  ensureWelcomeMails,
} from '../lib/mail';

const CATEGORY_LABEL: Record<MailCategory, string> = {
  system: '系统',
  review: '审核请求',
  verdict: '审核结果',
  appeal: '申诉',
  cv: 'CV 入账',
};

const CATEGORY_COLOR: Record<MailCategory, string> = {
  system: '#7fa0c0',
  review: '#e0b060',
  verdict: '#90c0e0',
  appeal: '#c08070',
  cv: '#FFD700',
};

const CATEGORY_ICON: Record<MailCategory, string> = {
  system: '📜',
  review: '✉️',
  verdict: '📊',
  appeal: '⚖️',
  cv: '🏆',
};

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (hr < 24) return `${hr} 小时前`;
  if (day < 7) return `${day} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

export function MailBox() {
  const [open, setOpen] = useState(false);
  const [mails, setMails] = useState<Mail[]>(() => {
    ensureWelcomeMails();
    return getAllMails();
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Refresh from storage (other systems may have added mails)
  const refresh = () => setMails(getAllMails());

  useEffect(() => {
    const onOpen = () => setOpen((p) => !p);
    EventBus.on('open-mailbox', onOpen);

    // External systems can call this when sending mail
    const onMailReceived = () => refresh();
    EventBus.on('mail-received', onMailReceived);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      EventBus.off('open-mailbox', onOpen);
      EventBus.off('mail-received', onMailReceived);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // When user opens a mail, mark it read
  useEffect(() => {
    if (!selectedId) return;
    const target = mails.find((m) => m.id === selectedId);
    if (target && !target.read) {
      markAsRead(selectedId);
      refresh();
    }
  }, [selectedId, mails]);

  const handleDelete = (id: string) => {
    deleteMail(id);
    setSelectedId(null);
    refresh();
  };

  const unreadCount = mails.filter((m) => !m.read).length;
  const selected = selectedId ? mails.find((m) => m.id === selectedId) : null;

  if (!open) return null;

  return (
    <div
      onClick={() => { setOpen(false); setSelectedId(null); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(8, 12, 18, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
        animation: 'fadeIn 0.25s ease-out',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(900px, 90vw)',
          height: 'min(640px, 80vh)',
          background: 'rgba(20, 24, 30, 0.96)',
          border: '2px solid rgba(220, 180, 60, 0.4)',
          borderRadius: 8,
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f5f0e0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(220, 180, 60, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(30, 35, 45, 0.6)',
          }}
        >
          <div>
            <div style={{ fontSize: 18, color: '#FFD700', letterSpacing: '0.15em' }}>
              📬 收件箱
            </div>
            <div style={{ fontSize: 11, color: '#a8b3a0', marginTop: 2 }}>
              共 {mails.length} 封 · 未读 {unreadCount}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#8a8576' }}>
            K / Esc 关闭
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Mail list */}
          <div
            style={{
              width: 320,
              borderRight: '1px solid rgba(220, 180, 60, 0.15)',
              overflowY: 'auto',
            }}
          >
            {mails.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: '#8a8576',
                  fontSize: 12,
                  marginTop: 80,
                }}
              >
                收件箱是空的
              </div>
            ) : (
              mails.map((m) => {
                const isSelected = selectedId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(245, 240, 224, 0.06)',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'rgba(255, 215, 0, 0.08)'
                        : 'transparent',
                      borderLeft: isSelected
                        ? '3px solid #FFD700'
                        : m.read
                          ? '3px solid transparent'
                          : '3px solid #7fa0c0',
                      transition: 'all 0.15s',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ fontSize: 16, lineHeight: 1.2 }}>
                      {CATEGORY_ICON[m.category]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 6,
                          alignItems: 'baseline',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: m.read ? 400 : 600,
                            color: m.read ? '#c8c0a8' : '#f5f0e0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {m.subject}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: '#fff',
                            background: CATEGORY_COLOR[m.category],
                            padding: '1px 5px',
                            borderRadius: 3,
                            flexShrink: 0,
                          }}
                        >
                          {CATEGORY_LABEL[m.category]}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#a8b3a0',
                          marginTop: 4,
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{m.from}</span>
                        <span>{formatTime(m.sentAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Mail detail */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {selected ? (
              <>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#FFD700',
                    marginBottom: 8,
                  }}
                >
                  {selected.subject}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#a8b3a0',
                    marginBottom: 20,
                    display: 'flex',
                    gap: 16,
                  }}
                >
                  <span>来自 {selected.from}</span>
                  <span>{formatTime(selected.sentAt)}</span>
                  <span style={{ color: CATEGORY_COLOR[selected.category] }}>
                    {CATEGORY_LABEL[selected.category]}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.8,
                    color: '#e0d8c0',
                    whiteSpace: 'pre-wrap',
                    marginBottom: 28,
                  }}
                >
                  {selected.body}
                </div>

                {/* Actions */}
                {selected.actions && selected.actions.length > 0 && (
                  <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
                    {selected.actions.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => EventBus.emit(a.event, selected)}
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          background: '#FFD700',
                          color: '#1a1a1a',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleDelete(selected.id)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    background: 'transparent',
                    color: '#8a7060',
                    border: '1px solid rgba(192, 128, 112, 0.3)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  删除
                </button>
              </>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  color: '#8a8576',
                  fontSize: 13,
                  marginTop: 80,
                }}
              >
                ← 选择左侧邮件查看
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
