import { useEffect, useState } from 'react';
import type { Mail } from '../lib/mail';
import { useMail } from '../hooks/useMail';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { EventBus } from '../game/EventBus';
import { PixelButton, Chip } from '../ui';
import { MailItem } from './MailItem';

/**
 * NewMailBox · 像素古籍风邮件面板
 *
 * 布局：左 sidebar 列表（150px）+ 右详情区
 * 尺寸：480×560（跟 NewChatPanel 一致）
 */

const PANEL_WIDTH = 480;
const PANEL_HEIGHT = 560;
const SIDEBAR_WIDTH = 160;

const CATEGORY_LABELS: Record<Mail['category'], string> = {
  system: '系统',
  review: '审核',
  verdict: '裁定',
  appeal: '申诉',
  cv: 'CV',
};

const CATEGORY_TONES: Record<Mail['category'], 'spring' | 'gold' | 'jade' | 'danger' | ''> = {
  system: '',
  review: 'gold',
  verdict: 'jade',
  appeal: 'danger',
  cv: 'spring',
};

export function NewMailBox() {
  const [open, setOpen] = useOpenViaEventBus('mail', 'open-mailbox');
  const { mails, unreadCount, markAsRead, deleteMail } = useMail();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 自动选第一封
  useEffect(() => {
    if (!open) return;
    if (selectedId) return;
    if (mails.length === 0) return;
    setSelectedId(mails[0].id);
  }, [open, selectedId, mails]);

  // 选中时标记已读
  useEffect(() => {
    if (!selectedId) return;
    const mail = mails.find((m) => m.id === selectedId);
    if (mail && !mail.read) {
      markAsRead(selectedId);
    }
  }, [selectedId, mails, markAsRead]);

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

  const selected = mails.find((m) => m.id === selectedId) || null;

  return (
    <div
      className="bg-paper"
      style={{
        position: 'fixed',
        bottom: 80,
        right: 12,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
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
          padding: '10px 12px',
          borderBottom: '3px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>✉</span>
          <span className="t-title" style={{ fontSize: 16 }}>
            邮件
          </span>
          {unreadCount > 0 && <Chip tone="gold">未读 · {unreadCount}</Chip>}
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

      {/* 主体：左 sidebar + 右详情 */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar 邮件列表 */}
        <div
          style={{
            width: SIDEBAR_WIDTH,
            borderRight: '2px solid var(--wood-3)',
            background: 'var(--paper-1)',
            overflowY: 'auto',
          }}
        >
          {mails.length === 0 ? (
            <div
              style={{
                padding: 16,
                fontSize: 11,
                color: 'var(--ink-faint)',
                textAlign: 'center',
                lineHeight: 1.6,
              }}
            >
              暂无邮件
            </div>
          ) : (
            mails.map((mail) => (
              <MailItem
                key={mail.id}
                mail={mail}
                active={selectedId === mail.id}
                onClick={() => setSelectedId(mail.id)}
              />
            ))
          )}
        </div>

        {/* 详情区 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: 'var(--paper-0)',
          }}
        >
          {selected ? (
            <MailDetail
              mail={selected}
              onDelete={() => {
                deleteMail(selected.id);
                setSelectedId(null);
              }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: 'var(--ink-faint)',
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 36 }}>✉</div>
              <div>选择左侧邮件</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MailDetailProps {
  mail: Mail;
  onDelete: () => void;
}

function MailDetail({ mail, onDelete }: MailDetailProps) {
  const time = new Date(mail.sentAt);
  const timeStr = `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(
    time.getDate(),
  )} ${pad(time.getHours())}:${pad(time.getMinutes())}`;

  return (
    <>
      {/* 头部 · 类别 + 主题 + 来源 + 时间 */}
      <div
        style={{
          padding: 14,
          borderBottom: '2px solid var(--wood-2)',
          background: 'var(--paper-1)',
        }}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <Chip tone={CATEGORY_TONES[mail.category]}>
            {CATEGORY_LABELS[mail.category]}
          </Chip>
        </div>
        <h3
          className="t-title"
          style={{ fontSize: 16, margin: 0, marginBottom: 6 }}
        >
          {mail.subject}
        </h3>
        <div
          className="t-faint"
          style={{
            fontSize: 11,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>来自：{mail.from}</span>
          <span className="mono">{timeStr}</span>
        </div>
      </div>

      {/* 正文 */}
      <div
        style={{
          flex: 1,
          padding: 16,
          overflowY: 'auto',
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--ink)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {mail.body}
      </div>

      {/* 底部操作 */}
      <div
        style={{
          padding: 10,
          borderTop: '2px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          gap: 6,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {mail.actions?.map((action) => (
            <PixelButton
              key={action.event}
              variant="pb-primary"
              size="pb-sm"
              onClick={() => EventBus.emit(action.event, mail)}
            >
              {action.label}
            </PixelButton>
          ))}
        </div>
        <PixelButton size="pb-sm" onClick={onDelete}>
          删除
        </PixelButton>
      </div>
    </>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export default NewMailBox;
