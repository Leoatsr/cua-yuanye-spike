import { useEffect, useState, useRef, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import {
  chatManager,
  CHAT_LIMITS,
  type ChatMessage,
  type ChatChannelType,
  type PrivateConversation,
} from '../lib/chatStore';
import { fetchProfileByUsername } from '../lib/profileStore';

/**
 * G2-A · 聊天浮窗
 *
 * - 右下角微信尺寸（350 × 480）
 * - T 键开/关
 * - World tab（持久化）+ Scene tab（仅实时）
 * - 私聊 tab 占位（G2-C 启用）
 */

const PANEL_WIDTH = 350;
const PANEL_HEIGHT = 480;

const SCENE_DISPLAY_NAMES: Record<string, string> = {
  Main: '萌芽镇',
  SproutCity: '共创之都',
  GovHill: '议政高地',
  GrandPlaza: '大集会广场',
  Interior: '室内',
  KaiyuanLou: '开源楼',
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

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatChannelType>('world');
  const [messages, setMessages] = useState<{
    world: ChatMessage[];
    scene: ChatMessage[];
    private: Map<string, ChatMessage[]>;  // G2-C: keyed by other_user_id
  }>({ world: [], scene: [], private: new Map() });
  const [currentSceneKey, setCurrentSceneKey] = useState<string | null>(null);
  // G2-C: private conversations
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [unread, setUnread] = useState({ world: 0, scene: 0, private: 0 });
  // G2-D: username search
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for incoming messages
  useEffect(() => {
    const onMsg = (msg: ChatMessage) => {
      if (msg.channel_type === 'private') {
        // G2-C: route to specific conversation
        // Determine the "other user" from sender / recipient
        setMyUserId((myId) => {
          if (!myId) return myId;
          const otherId = msg.sender_id === myId ? (msg.recipient_id ?? '') : msg.sender_id;
          if (!otherId) return myId;
          setMessages((prev) => {
            const existing = prev.private.get(otherId) ?? [];
            if (existing.some((m) => m.id === msg.id)) return prev;
            const next = new Map(prev.private);
            next.set(otherId, [...existing, msg].slice(-100));
            return { ...prev, private: next };
          });
          // Bump unread if not active
          setOpen((isOpen) => {
            setActiveTab((tab) => {
              setActiveRecipientId((curRecipient) => {
                const isActiveConversation =
                  isOpen && tab === 'private' && curRecipient === otherId;
                if (!isActiveConversation && msg.sender_id !== myId) {
                  setUnread((u) => ({ ...u, private: u.private + 1 }));
                  // Also refresh conversations to update last message
                  void chatManager.loadMyConversations();
                }
                return curRecipient;
              });
              return tab;
            });
            return isOpen;
          });
          return myId;
        });
        return;
      }
      // World / Scene
      setMessages((prev) => {
        const list = msg.channel_type === 'world' ? prev.world : prev.scene;
        if (list.some((m) => m.id === msg.id)) return prev;
        const next = [...list, msg].slice(-100);
        return msg.channel_type === 'world'
          ? { ...prev, world: next }
          : { ...prev, scene: next };
      });
      setOpen((isOpen) => {
        setActiveTab((tab) => {
          if (!isOpen || tab !== msg.channel_type) {
            setUnread((u) => ({
              ...u,
              [msg.channel_type]: (u[msg.channel_type as 'world' | 'scene'] ?? 0) + 1,
            }));
          }
          return tab;
        });
        return isOpen;
      });
    };
    const onHistory = (data: {
      channelType: ChatChannelType;
      channelKey: string;
      messages: ChatMessage[];
    }) => {
      if (data.channelType === 'world') {
        setMessages((prev) => ({ ...prev, world: data.messages }));
      } else if (data.channelType === 'private') {
        // Find which other user this is for
        setMyUserId((myId) => {
          if (!myId) return myId;
          // channel_key is "userA::userB" sorted
          const ids = data.channelKey.split('::');
          const otherId = ids[0] === myId ? ids[1] : ids[0];
          setMessages((prev) => {
            const next = new Map(prev.private);
            next.set(otherId, data.messages);
            return { ...prev, private: next };
          });
          return myId;
        });
      }
    };
    const onConvsLoaded = (list: PrivateConversation[]) => {
      setConversations(list);
      // Aggregate unread
      const totalUnread = list.reduce((sum, c) => sum + Number(c.unread_count ?? 0), 0);
      setUnread((u) => ({ ...u, private: totalUnread }));
    };

    EventBus.on('chat-message-received', onMsg);
    EventBus.on('chat-history-loaded', onHistory);
    EventBus.on('chat-conversations-loaded', onConvsLoaded);

    // G2-B: scene change clears scene chat
    const onSceneChanged = (data: { sceneKey: string | null }) => {
      setCurrentSceneKey(data.sceneKey);
      setMessages((prev) => ({ ...prev, scene: [] }));
      setUnread((u) => ({ ...u, scene: 0 }));
    };
    EventBus.on('chat-scene-changed', onSceneChanged);

    // Open private chat from external trigger (OnlineRoster / E interaction / etc)
    const onOpenPrivate = (data: { otherUserId: string }) => {
      setOpen(true);
      setActiveTab('private');
      setActiveRecipientId(data.otherUserId);
      void chatManager.subscribePrivate(data.otherUserId);
      void chatManager.loadPrivateHistory(data.otherUserId);
      void chatManager.loadMyConversations();
    };
    EventBus.on('open-private-chat', onOpenPrivate);

    // G2-A-fix: actively pull world history on mount
    void chatManager.loadRecentHistory('world', 'world');
    setCurrentSceneKey(chatManager.getCurrentSceneKey());

    // G2-C: load conversations + subscribe to all existing private channels
    void (async () => {
      const supabase = (await import('../lib/supabase')).getSupabase();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setMyUserId(session.user.id);
      }
      await chatManager.subscribeAllExistingPrivate();
    })();

    return () => {
      EventBus.off('chat-message-received', onMsg);
      EventBus.off('chat-history-loaded', onHistory);
      EventBus.off('chat-conversations-loaded', onConvsLoaded);
      EventBus.off('chat-scene-changed', onSceneChanged);
      EventBus.off('open-private-chat', onOpenPrivate);
    };
  }, []);

  // Listen for T key open command
  useEffect(() => {
    const onOpen = () => {
      setOpen((prev) => !prev);
    };
    EventBus.on('toggle-chat-panel', onOpen);
    return () => {
      EventBus.off('toggle-chat-panel', onOpen);
    };
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    if (!open) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab, open]);

  // Clear unread when opening or switching tab
  useEffect(() => {
    if (!open) return;
    setUnread((u) => ({ ...u, [activeTab]: 0 }));
  }, [open, activeTab]);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      // Give it a beat to render
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSend = useCallback(async () => {
    if (sending) return;
    if (input.trim().length === 0) return;
    if (activeTab === 'private') {
      if (!activeRecipientId) {
        setErrorMsg('请先选择一个私聊会话');
        return;
      }
      setSending(true);
      setErrorMsg('');
      const result = await chatManager.sendPrivate(activeRecipientId, input);
      setSending(false);
      if (result.ok) {
        setInput('');
        // Refresh conversations to show updated last message
        void chatManager.loadMyConversations();
      } else {
        setErrorMsg(result.error ?? '发送失败');
      }
      return;
    }
    setSending(true);
    setErrorMsg('');
    const result = await chatManager.sendMessage(activeTab, input);
    setSending(false);
    if (result.ok) {
      setInput('');
    } else {
      setErrorMsg(result.error ?? '发送失败');
    }
  }, [input, activeTab, sending, activeRecipientId]);

  // G2-D: search by username and start private chat
  const handleSearchUsername = useCallback(async () => {
    const query = searchInput.trim().replace(/^@/, '');
    if (query.length === 0) return;
    if (searching) return;
    setSearching(true);
    setSearchError('');
    try {
      const profile = await fetchProfileByUsername(query);
      if (!profile) {
        setSearchError(`找不到用户名 "${query}"`);
        return;
      }
      // Check not self
      if (myUserId && profile.user_id === myUserId) {
        setSearchError('不能私聊自己');
        return;
      }
      // Open conversation
      EventBus.emit('open-private-chat', { otherUserId: profile.user_id });
      setSearchInput('');
    } catch {
      setSearchError('搜索失败');
    } finally {
      setSearching(false);
    }
  }, [searchInput, searching, myUserId]);

  if (!open) {
    // Show pulsing tab if any unread
    const totalUnread = unread.world + unread.scene + unread.private;
    return (
      <button
        onClick={() => setOpen(true)}
        title="聊天 (T)"
        style={{
          position: 'fixed',
          right: 16, bottom: 16,
          zIndex: 100,
          padding: '8px 14px',
          background: totalUnread > 0
            ? 'linear-gradient(135deg, rgba(127, 192, 144, 0.25), rgba(96, 165, 250, 0.18))'
            : 'rgba(20, 24, 30, 0.85)',
          border: `1px solid ${totalUnread > 0 ? 'rgba(127, 192, 144, 0.6)' : 'rgba(168, 179, 160, 0.3)'}`,
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: '#f5f0e0',
          fontSize: 12,
          letterSpacing: '0.05em',
          backdropFilter: 'blur(4px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: totalUnread > 0 ? 'chatBadgePulse 2s ease-in-out infinite' : 'none',
        }}
      >
        💬 聊天 <span style={{ fontSize: 10, color: '#8a8576' }}>(T)</span>
        {totalUnread > 0 && (
          <span style={{
            background: '#dc2626', color: '#fff',
            fontSize: 10, padding: '1px 6px', borderRadius: 999,
            fontFamily: 'monospace',
          }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
        <style>{`
          @keyframes chatBadgePulse {
            0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
            50% { box-shadow: 0 2px 16px rgba(127, 192, 144, 0.5); }
          }
        `}</style>
      </button>
    );
  }

  const currentMessages: ChatMessage[] =
    activeTab === 'world' ? messages.world :
    activeTab === 'scene' ? messages.scene :
    activeRecipientId ? (messages.private.get(activeRecipientId) ?? []) :
    [];

  return (
    <div
      style={{
        position: 'fixed',
        right: 16, bottom: 16,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        zIndex: 100,
        background: 'linear-gradient(180deg, #1f2230 0%, #15171f 100%)',
        border: '1px solid rgba(184, 137, 58, 0.4)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        color: '#f5f0e0',
        overflow: 'hidden',
        animation: 'chatPanelSlide 0.25s ease-out',
      }}
    >
      {/* Header with tabs */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(184, 137, 58, 0.25)',
      }}>
        <Tab
          label="🌐 世界"
          active={activeTab === 'world'}
          unread={unread.world}
          onClick={() => setActiveTab('world')}
        />
        <Tab
          label={`📍 ${currentSceneKey ? (SCENE_DISPLAY_NAMES[currentSceneKey] ?? '此地') : '此地'}`}
          active={activeTab === 'scene'}
          unread={unread.scene}
          onClick={() => setActiveTab('scene')}
        />
        <Tab
          label="💌 私聊"
          active={activeTab === 'private'}
          unread={unread.private}
          onClick={() => {
            setActiveTab('private');
            void chatManager.loadMyConversations();
          }}
        />
        <button
          onClick={() => setOpen(false)}
          style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            background: 'transparent',
            border: 'none',
            color: '#a8a08e',
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
          title="关闭 (Esc)"
        >
          ×
        </button>
      </div>

      {/* G2-D: Username search (only on private tab) */}
      {activeTab === 'private' && (
        <div style={{
          padding: '6px 10px',
          borderBottom: '1px solid rgba(184, 137, 58, 0.15)',
          background: 'rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 11, color: '#a8a08e' }}>🔍</span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSearchError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSearchUsername();
              }
              e.stopPropagation();
            }}
            placeholder="@username 找人聊"
            disabled={searching}
            style={{
              flex: 1,
              padding: '4px 8px',
              background: 'rgba(168, 179, 160, 0.05)',
              border: '1px solid rgba(168, 179, 160, 0.2)',
              borderRadius: 3,
              color: '#f5f0e0', fontSize: 11,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={() => void handleSearchUsername()}
            disabled={searching || searchInput.trim().length === 0}
            style={{
              padding: '4px 10px', fontSize: 10,
              background: searchInput.trim().length > 0
                ? 'rgba(96, 165, 250, 0.18)'
                : 'rgba(168, 179, 160, 0.05)',
              color: searchInput.trim().length > 0 ? '#a5c8ff' : '#6e6856',
              border: `1px solid ${searchInput.trim().length > 0
                ? 'rgba(96, 165, 250, 0.4)'
                : 'rgba(168, 179, 160, 0.15)'}`,
              borderRadius: 3,
              cursor: searchInput.trim().length > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {searching ? '...' : '搜索'}
          </button>
        </div>
      )}
      {searchError && activeTab === 'private' && (
        <div style={{
          padding: '4px 12px', fontSize: 10,
          background: 'rgba(220, 38, 38, 0.12)',
          color: '#e0a090',
          borderBottom: '1px solid rgba(220, 38, 38, 0.25)',
        }}>
          ⚠️ {searchError}
        </div>
      )}

      {/* G2-C: Private conversation selector (only on private tab) */}
      {activeTab === 'private' && conversations.length > 0 && (
        <div style={{
          padding: '6px 10px',
          borderBottom: '1px solid rgba(184, 137, 58, 0.2)',
          background: 'rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: '#a8a08e' }}>
            💌
          </span>
          <select
            value={activeRecipientId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setActiveRecipientId(id);
              if (id) {
                void chatManager.subscribePrivate(id);
                void chatManager.loadPrivateHistory(id);
              }
            }}
            style={{
              flex: 1,
              padding: '4px 8px',
              background: 'rgba(168, 179, 160, 0.05)',
              border: '1px solid rgba(168, 179, 160, 0.2)',
              borderRadius: 3,
              color: '#f5f0e0', fontSize: 11,
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            <option value="">— 选择会话 —</option>
            {conversations.map((c) => (
              <option key={c.other_user_id} value={c.other_user_id}>
                {c.other_user_name}
                {c.unread_count > 0 ? ` (${c.unread_count})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          padding: '8px 12px',
          overflowY: 'auto',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {activeTab === 'private' && conversations.length === 0 ? (
          <div style={{
            textAlign: 'center', color: '#8a8576',
            padding: '40px 20px', fontStyle: 'italic',
          }}>
            — 暂无私聊会话 —
            <br />
            <span style={{ fontSize: 10, marginTop: 8, display: 'block' }}>
              点击顶部"在线 X"列表里的玩家头像 → "💌 私聊" 开启会话
            </span>
          </div>
        ) : activeTab === 'private' && !activeRecipientId ? (
          <div style={{
            textAlign: 'center', color: '#8a8576',
            padding: '40px 20px', fontStyle: 'italic',
          }}>
            — 请从顶部下拉选择会话 —
          </div>
        ) : activeTab === 'scene' && !currentSceneKey ? (
          <div style={{
            textAlign: 'center', color: '#8a8576',
            padding: '40px 20px', fontStyle: 'italic',
          }}>
            🔒 当前不在任何 scene
          </div>
        ) : currentMessages.length === 0 ? (
          <div style={{
            textAlign: 'center', color: '#8a8576',
            padding: '40px 20px', fontStyle: 'italic',
          }}>
            {activeTab === 'world'
              ? '— 暂无消息。说点什么开始聊天 —'
              : activeTab === 'private'
                ? '— 还没消息，先打个招呼吧 —'
                : `— ${SCENE_DISPLAY_NAMES[currentSceneKey ?? ''] ?? '此地'}静悄悄。该说话啦 —`}
          </div>
        ) : (
          currentMessages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} myUserId={myUserId} />
          ))
        )}
      </div>

      {/* Error message */}
      {errorMsg && (
        <div style={{
          padding: '6px 12px', fontSize: 11,
          background: 'rgba(220, 38, 38, 0.15)',
          color: '#e0a090',
          borderTop: '1px solid rgba(220, 38, 38, 0.3)',
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid rgba(184, 137, 58, 0.2)',
        background: 'rgba(0,0,0,0.2)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
            // T key inside input should NOT toggle panel
            e.stopPropagation();
          }}
          placeholder={
            activeTab === 'private'
              ? (activeRecipientId
                ? `发给 ${conversations.find(c => c.other_user_id === activeRecipientId)?.other_user_name ?? '对方'}`
                : '先选择一个会话...')
              : activeTab === 'scene' && !currentSceneKey
                ? '请先进入一个 scene...'
                : `在「${activeTab === 'world' ? '世界' : SCENE_DISPLAY_NAMES[currentSceneKey ?? ''] ?? '此地'}」说点什么 (≤200)`
          }
          maxLength={CHAT_LIMITS.CONTENT_MAX}
          disabled={
            sending
            || (activeTab === 'private' && !activeRecipientId)
            || (activeTab === 'scene' && !currentSceneKey)
          }
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'rgba(168, 179, 160, 0.05)',
            border: '1px solid rgba(168, 179, 160, 0.25)',
            borderRadius: 4,
            color: '#f5f0e0', fontSize: 12,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={
            sending
            || input.trim().length === 0
            || (activeTab === 'private' && !activeRecipientId)
            || (activeTab === 'scene' && !currentSceneKey)
          }
          style={{
            padding: '6px 14px',
            background: input.trim().length > 0 && !(activeTab === 'private' && !activeRecipientId) && !(activeTab === 'scene' && !currentSceneKey)
              ? 'rgba(127, 192, 144, 0.2)'
              : 'rgba(168, 179, 160, 0.05)',
            color: input.trim().length > 0 && !(activeTab === 'private' && !activeRecipientId) && !(activeTab === 'scene' && !currentSceneKey)
              ? '#7fc090'
              : '#6e6856',
            border: `1px solid ${input.trim().length > 0 && !(activeTab === 'private' && !activeRecipientId) && !(activeTab === 'scene' && !currentSceneKey)
              ? 'rgba(127, 192, 144, 0.5)'
              : 'rgba(168, 179, 160, 0.15)'}`,
            borderRadius: 4,
            cursor: input.trim().length > 0 && !(activeTab === 'private' && !activeRecipientId) && !(activeTab === 'scene' && !currentSceneKey) ? 'pointer' : 'not-allowed',
            fontSize: 12,
            fontFamily: 'inherit',
            letterSpacing: '0.05em',
          }}
        >
          {sending ? '...' : '发送'}
        </button>
      </div>

      <style>{`
        @keyframes chatPanelSlide {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ===== Sub-components =====

function Tab({
  label, active, unread, onClick, disabled,
}: {
  label: string;
  active: boolean;
  unread: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        background: active ? 'rgba(184, 137, 58, 0.15)' : 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? '#b8893a' : 'transparent'}`,
        color: disabled ? '#6e6856' : (active ? '#e0b060' : '#a8a08e'),
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '0.05em',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: 4, right: 2,
          background: '#dc2626', color: '#fff',
          fontSize: 9, padding: '0 4px', borderRadius: 999,
          fontFamily: 'monospace', minWidth: 14, textAlign: 'center',
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

function MessageRow({ msg, myUserId }: { msg: ChatMessage; myUserId?: string | null }) {
  const time = new Date(msg.created_at);
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
  const isBot = msg.sender_id.startsWith('bot-');
  const isSystem = msg.sender_id === 'system';
  const isMine = myUserId && msg.sender_id === myUserId;

  if (isSystem) {
    return (
      <div style={{
        textAlign: 'center', margin: '6px 0',
        fontSize: 11, color: '#6e6856',
        fontStyle: 'italic',
      }}>
        — {msg.content} —
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 8,
      display: 'flex', gap: 6,
      alignItems: 'flex-start',
    }}>
      <div style={{
        flexShrink: 0,
        width: 24, height: 24,
        borderRadius: '50%',
        background: isBot ? '#3a3a4a' : '#2a3a4a',
        overflow: 'hidden',
        border: '1px solid rgba(168, 179, 160, 0.2)',
      }}>
        {msg.sender_avatar ? (
          <img
            src={msg.sender_avatar}
            alt={msg.sender_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: '#a8a08e',
          }}>
            {msg.sender_name.slice(0, 1)}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          fontSize: 11,
        }}>
          <span style={{
            color: isBot ? '#a78bfa' : (isMine ? '#7fc090' : '#a5c8ff'),
            fontWeight: 500,
          }}>
            {isMine ? '我' : msg.sender_name}
          </span>
          <span style={{ color: '#6e6856', fontSize: 10, fontFamily: 'monospace' }}>
            {timeStr}
          </span>
        </div>
        <div style={{
          color: '#f5f0e0', fontSize: 12,
          wordBreak: 'break-word',
          marginTop: 1,
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}
