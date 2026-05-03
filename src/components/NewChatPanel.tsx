import { useEffect, useRef, useState } from 'react';
import {
  chatManager,
  CHAT_LIMITS,
  type ChatChannelType,
} from '../lib/chatStore';
import { fetchMyProfile } from '../lib/profileStore';
import type { UserProfile } from '../lib/profileStore';
import { useChatHistory } from '../hooks/useChatHistory';
import { useToggleViaEventBus } from '../hooks/useToggleViaEventBus';
import { useCurrentScene } from '../hooks/useCurrentScene';
import { usePrivateConversations } from '../hooks/usePrivateConversations';
import { useUnreadCounts } from '../hooks/useUnreadCounts';
import { PixelButton } from '../ui';
import { ChatMessageItem } from './ChatMessageItem';
import { ConversationItem } from './ConversationItem';
import { UserSearchBar } from './UserSearchBar';

/**
 * NewChatPanel · 完整像素聊天面板
 *
 * Wave 2.3.B · 完整功能:
 *   - 世界 / 场景 / 私聊 3 频道
 *   - 私聊 sidebar + recipient 切换
 *   - G2-D 用户名搜索
 *   - 各 tab 独立未读计数
 *   - 历史消息加载
 *
 * 尺寸: 480×560（比 Wave 2.3.A 的 380×520 大，容纳私聊 sidebar）
 */

const PANEL_WIDTH = 480;
const PANEL_HEIGHT = 560;
const SIDEBAR_WIDTH = 130;

const SCENE_DISPLAY_NAMES: Record<string, string> = {
  Main: '萌芽镇',
  SproutCity: '共创之都',
  GovHill: '议政高地',
  GrandPlaza: '大集会广场',
  Interior: '室内',
  KaiyuanLou: '开元楼',
  ShengwenTai: '声闻台',
  DuliangGe: '度量阁',
  YincaiFang: '引才坊',
  SisuanSuo: '司算所',
  YishiTing: '议事厅',
  WangqiLou: '望气楼',
  GongdeTang: '功德堂',
  VisionTower: '远见塔',
  CouncilHall: '执政厅',
  MirrorPavilion: '明镜阁',
};

export function NewChatPanel() {
  const [open, setOpen] = useToggleViaEventBus('chat', 'toggle-chat-panel');
  const [activeTab, setActiveTab] = useState<ChatChannelType>('world');
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [activeRecipientProfile, setActiveRecipientProfile] = useState<{
    name: string;
    avatar_url: string | null;
  } | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  const sceneKey = useCurrentScene();
  const { conversations, reload: reloadConversations } = usePrivateConversations();

  // 当前频道 channelKey
  const channelKey =
    activeTab === 'world'
      ? 'world'
      : activeTab === 'scene'
      ? sceneKey
      : activeRecipientId
      ? buildPrivateChannelKey(myUserId || '', activeRecipientId)
      : null;

  // 历史消息（按当前 tab）
  const messages = useChatHistory(activeTab, channelKey, activeRecipientId || undefined);

  // 未读计数
  const { counts: unreadCounts } = useUnreadCounts({
    activeTab,
    activeRecipientId,
    myUserId,
    panelOpen: open,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownTimerRef = useRef<number | null>(null);

  // 拿当前用户 id
  useEffect(() => {
    void fetchMyProfile().then((p) => {
      if (p) setMyUserId(p.user_id);
    });
  }, []);

  // 打开时 focus 输入框
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, activeTab, activeRecipientId]);

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

  // 倒计时
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

  // 切到 private tab 时如果没选 recipient 自动选第一个
  useEffect(() => {
    if (activeTab !== 'private') return;
    if (activeRecipientId) return;
    if (conversations.length === 0) return;
    const first = conversations[0];
    setActiveRecipientId(first.other_user_id);
    setActiveRecipientProfile({
      name: first.other_user_name,
      avatar_url: first.other_user_avatar,
    });
  }, [activeTab, activeRecipientId, conversations]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || cooldownLeft > 0) return;
    if (trimmed.length > CHAT_LIMITS.CONTENT_MAX) {
      setErrorMsg(`消息过长（${trimmed.length}/${CHAT_LIMITS.CONTENT_MAX}）`);
      return;
    }

    // scene 频道必须有 sceneKey
    if (activeTab === 'scene' && !sceneKey) {
      setErrorMsg('当前没有进入任何场景');
      return;
    }
    // private 必须有 recipient
    if (activeTab === 'private' && !activeRecipientId) {
      setErrorMsg('请先选择一个对话');
      return;
    }

    setSending(true);
    setErrorMsg('');
    try {
      let result;
      if (activeTab === 'private' && activeRecipientId) {
        result = await chatManager.sendPrivate(activeRecipientId, trimmed);
      } else {
        result = await chatManager.sendMessage(activeTab, trimmed);
      }

      if (!result.ok) {
        setErrorMsg(result.error || '发送失败');
      } else {
        setInput('');
        setCooldownLeft(Math.ceil(CHAT_LIMITS.COOLDOWN_MS / 1000));
        // private 发完更新 conversation 列表
        if (activeTab === 'private') {
          void reloadConversations();
        }
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

  const handleStartConversation = async (profile: UserProfile) => {
    setActiveRecipientId(profile.user_id);
    setActiveRecipientProfile({
      name: profile.display_name,
      avatar_url: profile.avatar_url,
    });
    setShowSearch(false);
    // 订阅这个 conversation 频道
    await chatManager.subscribePrivate(profile.user_id);
  };

  if (!open) return null;

  const charCount = input.length;
  const charNearLimit = charCount > CHAT_LIMITS.CONTENT_MAX * 0.85;
  const charOverLimit = charCount > CHAT_LIMITS.CONTENT_MAX;

  // Header 标题
  const headerTitle =
    activeTab === 'world'
      ? '聊天 · 世界频道'
      : activeTab === 'scene'
      ? `聊天 · ${sceneKey ? SCENE_DISPLAY_NAMES[sceneKey] || sceneKey : '场景'}`
      : activeRecipientProfile
      ? `聊天 · ${activeRecipientProfile.name}`
      : '聊天 · 私聊';

  // 输入框 placeholder
  const placeholder =
    cooldownLeft > 0
      ? `冷却中 ${cooldownLeft}s...`
      : activeTab === 'world'
      ? '说点什么...'
      : activeTab === 'scene'
      ? sceneKey
        ? '场景内消息...'
        : '当前没在任何场景'
      : activeRecipientId
      ? `给 ${activeRecipientProfile?.name} 发消息...`
      : '请先选择对话';

  // 输入框 disabled 条件
  const inputDisabled =
    sending ||
    cooldownLeft > 0 ||
    (activeTab === 'scene' && !sceneKey) ||
    (activeTab === 'private' && !activeRecipientId);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span
            className="t-title"
            style={{
              fontSize: 14,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {headerTitle}
          </span>
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

      {/* 频道 tabs · 全部激活 */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          background: 'var(--paper-2)',
          borderBottom: '2px solid var(--wood-3)',
        }}
      >
        <TabButton
          active={activeTab === 'world'}
          label="🌍 世界"
          unread={unreadCounts.world}
          onClick={() => setActiveTab('world')}
        />
        <TabButton
          active={activeTab === 'scene'}
          label="📍 场景"
          unread={unreadCounts.scene}
          onClick={() => setActiveTab('scene')}
          disabled={!sceneKey}
          hint={!sceneKey ? '未进入场景' : undefined}
        />
        <TabButton
          active={activeTab === 'private'}
          label="✉ 私聊"
          unread={unreadCounts.private}
          onClick={() => setActiveTab('private')}
        />
      </div>

      {/* 主体区 · 私聊有 sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 私聊 sidebar */}
        {activeTab === 'private' && (
          <div
            style={{
              width: SIDEBAR_WIDTH,
              borderRight: '2px solid var(--wood-3)',
              background: 'var(--paper-1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* 搜索栏 toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              style={{
                padding: '8px',
                background: showSearch ? 'var(--paper-3)' : 'var(--paper-2)',
                border: 'none',
                borderBottom: '2px solid var(--wood-3)',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--wood-3)',
                fontFamily: 'var(--f-pixel)',
              }}
            >
              {showSearch ? '✕ 关搜索' : '+ 新对话'}
            </button>
            {showSearch && (
              <UserSearchBar
                onStartConversation={handleStartConversation}
                myUserId={myUserId}
              />
            )}
            {/* conversation 列表 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {conversations.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    fontSize: 11,
                    color: 'var(--ink-faint)',
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}
                >
                  暂无对话
                  <br />
                  点 "+ 新对话"
                </div>
              ) : (
                conversations.map((conv) => (
                  <ConversationItem
                    key={conv.other_user_id}
                    conversation={conv}
                    active={activeRecipientId === conv.other_user_id}
                    onClick={() => {
                      setActiveRecipientId(conv.other_user_id);
                      setActiveRecipientProfile({
                        name: conv.other_user_name,
                        avatar_url: conv.other_user_avatar,
                      });
                    }}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* 消息列表 + 输入框 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
              <EmptyState activeTab={activeTab} hasRecipient={!!activeRecipientId} hasSceneKey={!!sceneKey} />
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
                placeholder={placeholder}
                disabled={inputDisabled}
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
                  sending ||
                  cooldownLeft > 0 ||
                  !input.trim() ||
                  charOverLimit ||
                  inputDisabled
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
      </div>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  unread?: number;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
}

function TabButton({
  label,
  active,
  unread = 0,
  onClick,
  disabled = false,
  hint,
}: TabButtonProps) {
  return (
    <button
      title={hint}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '8px 12px',
        textAlign: 'center',
        fontSize: 12,
        fontFamily: 'var(--f-pixel)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--paper-0)' : 'transparent',
        border: 'none',
        borderBottom: active ? '3px solid var(--gold)' : '3px solid transparent',
        color: disabled
          ? 'var(--ink-faint)'
          : active
          ? 'var(--wood-3)'
          : 'var(--ink)',
        opacity: disabled ? 0.4 : 1,
        position: 'relative',
        transition: 'all 0.15s',
      }}
    >
      {label}
      {unread > 0 && (
        <span
          style={{
            marginLeft: 6,
            background: 'var(--danger)',
            color: '#fff',
            fontSize: 9,
            padding: '1px 5px',
            border: '1px solid var(--wood-4)',
            fontFamily: 'var(--f-num)',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function EmptyState({
  activeTab,
  hasRecipient,
  hasSceneKey,
}: {
  activeTab: ChatChannelType;
  hasRecipient: boolean;
  hasSceneKey: boolean;
}) {
  let icon = '💬';
  let title = '世界频道还没有消息';
  let hint = '发出第一条消息，让大家看到你';

  if (activeTab === 'scene') {
    icon = '📍';
    if (!hasSceneKey) {
      title = '未进入任何场景';
      hint = '走进工坊或镇子内开始场景对话';
    } else {
      title = '场景频道还没有消息';
      hint = '场景内消息只对当前场景玩家可见';
    }
  } else if (activeTab === 'private') {
    icon = '✉';
    if (!hasRecipient) {
      title = '请选择一个对话';
      hint = '左侧列表选一个，或点 "+ 新对话"';
    } else {
      title = '还没有消息';
      hint = '发出第一条消息开始对话';
    }
  }

  return (
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
      <div style={{ fontSize: 36 }}>{icon}</div>
      <div>{title}</div>
      <div className="t-faint" style={{ fontSize: 11 }}>
        {hint}
      </div>
    </div>
  );
}

// 本地版 buildPrivateChannelKey（避免依赖 chatStore export，更稳）
function buildPrivateChannelKey(userA: string, userB: string): string {
  const ids = [userA, userB].sort();
  return `${ids[0]}::${ids[1]}`;
}

export default NewChatPanel;
