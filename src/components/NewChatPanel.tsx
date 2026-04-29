import { useEffect, useRef, useState } from 'react';
import {
  chatManager,
  CHAT_LIMITS,
  type ChatMessage,
} from '../lib/chatStore';
import { fetchMyProfile } from '../lib/profileStore';
import { useChatMessages } from '../hooks/useChatMessages';
import { useToggleViaEventBus } from '../hooks/useToggleViaEventBus';
import { PixelButton, Chip } from '../ui';
import { ChatMessageItem } from './ChatMessageItem';

/**
 * NewChatPanel · 像素古籍风聊天面板
 *
 * Wave 2.3.A · 只做世界频道
 *   - 350×480 微信尺寸（跟旧版一致）
 *   - 右下角浮动
 *   - T 键 / 'toggle-panel' EventBus 切换
 *   - 5s 反 spam
 *   - 200 字符上限
 *   - 滚动到底
 *
 * Wave 2.3.B（后续）
 *   - Scene 频道
 *   - Private 私聊 + conversation 列表
 *   - 用户名搜索
 */

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 520;

export function NewChatPanel() {
  const [open, setOpen] = useToggleViaEventBus('chat', 'toggle-chat-panel');
  const messages = useChatMessages('world');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownTimerRef = useRef<number | null>(null);

  // 拿当前用户 id（用于判断 isMine）
  useEffect(() => {
    void fetchMyProfile().then((p) => {
      if (p) setMyUserId(p.user_id);
    });
  }, []);

  // 打开时自动 focus 输入框
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 新消息自动滚到底
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

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

  // 倒计时定时器
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownLeft((c) => Math.max(0, c - 1));
    }, 1000);
    return () => {
      if (cooldownTimerRef.current !== null) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, [cooldownLeft]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || cooldownLeft > 0) return;
    if (trimmed.length > CHAT_LIMITS.CONTENT_MAX) {
      setErrorMsg(`消息过长（${trimmed.length}/${CHAT_LIMITS.CONTENT_MAX}）`);
      return;
    }

    setSending(true);
    setErrorMsg('');
    try {
      // chatManager.sendMessage(channelType, content, recipientId?)
      const result = await chatManager.sendMessage('world', trimmed);
      if (!result.ok) {
        setErrorMsg(result.error || '发送失败');
      } else {
        setInput('');
        setCooldownLeft(Math.ceil(CHAT_LIMITS.COOLDOWN_MS / 1000));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!open) return null;

  const charCount = input.length;
  const charNearLimit = charCount > CHAT_LIMITS.CONTENT_MAX * 0.85;
  const charOverLimit = charCount > CHAT_LIMITS.CONTENT_MAX;

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
          <span style={{ fontSize: 18 }}>💬</span>
          <span className="t-title" style={{ fontSize: 16 }}>
            聊天 · 世界频道
          </span>
          <Chip tone="spring">{messages.length}</Chip>
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

      {/* 频道 tabs · Wave 2.3.A 仅世界开启 · scene/private 灰色占位 */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          background: 'var(--paper-2)',
          borderBottom: '2px solid var(--wood-3)',
        }}
      >
        <TabButton active label="🌍 世界" />
        <TabButton label="📍 场景" disabled hint="Wave 2.3.B" />
        <TabButton label="✉ 私聊" disabled hint="Wave 2.3.B" />
      </div>

      {/* 消息列表 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          background: 'var(--paper-0)',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              color: 'var(--ink-faint)',
              fontSize: 13,
              textAlign: 'center',
              padding: '0 24px',
            }}
          >
            <div style={{ fontSize: 36 }}>💬</div>
            <div>世界频道还没有消息</div>
            <div className="t-faint" style={{ fontSize: 11 }}>
              发出第一条消息，让大家看到你
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              isMine={msg.sender_id === myUserId}
            />
          ))
        )}
      </div>

      {/* 输入区 */}
      <div
        style={{
          padding: 10,
          borderTop: '3px solid var(--wood-3)',
          background: 'var(--paper-1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {errorMsg && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--danger)',
              padding: '4px 6px',
              background: 'rgba(166, 70, 52, 0.1)',
              border: '1px solid var(--danger)',
            }}
          >
            ⚠ {errorMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            onKeyDown={onKeyDown}
            placeholder={
              cooldownLeft > 0
                ? `冷却中 ${cooldownLeft}s...`
                : '说点什么...'
            }
            disabled={sending || cooldownLeft > 0}
            maxLength={CHAT_LIMITS.CONTENT_MAX + 50}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: '2px solid var(--wood-4)',
              background: 'var(--paper-0)',
              fontSize: 13,
              fontFamily: 'var(--f-sans)',
              color: 'var(--ink)',
              outline: 'none',
            }}
          />
          <PixelButton
            variant="pb-primary"
            size="pb-sm"
            onClick={() => void send()}
            disabled={
              sending || cooldownLeft > 0 || !input.trim() || charOverLimit
            }
          >
            {sending ? '...' : '发送'}
          </PixelButton>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
          }}
        >
          <span className="t-faint">Enter 发送 · Esc 关闭</span>
          <span
            style={{
              color: charOverLimit
                ? 'var(--danger)'
                : charNearLimit
                ? 'var(--wood-3)'
                : 'var(--ink-faint)',
              fontFamily: 'var(--f-num)',
            }}
          >
            {charCount} / {CHAT_LIMITS.CONTENT_MAX}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  hint?: string;
}

function TabButton({ label, active = false, disabled = false, hint }: TabButtonProps) {
  return (
    <div
      title={hint}
      style={{
        flex: 1,
        padding: '8px 12px',
        textAlign: 'center',
        fontSize: 12,
        fontFamily: 'var(--f-pixel)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--paper-0)' : 'transparent',
        borderBottom: active ? '3px solid var(--gold)' : '3px solid transparent',
        color: disabled
          ? 'var(--ink-faint)'
          : active
          ? 'var(--wood-3)'
          : 'var(--ink)',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
      }}
    >
      {label}
      {hint && (
        <div className="t-faint" style={{ fontSize: 8, marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// Default export 也提供
export default NewChatPanel;

// 类型导出（避免 unused warning）
export type { ChatMessage };
