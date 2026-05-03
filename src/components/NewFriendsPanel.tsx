import { useEffect, useState } from 'react';
import { useFriends } from '../hooks/useFriends';
import { useFollows } from '../hooks/useFollows';
import { useOpenViaEventBus } from '../hooks/useOpenViaEventBus';
import { useProfile } from '../hooks/useProfile';
import type { UserProfile } from '../lib/profileStore';
import { fetchProfileByUsername } from '../lib/profileStore';
import { EventBus } from '../game/EventBus';
import { PixelButton } from '../ui';
import { FriendItem } from './FriendItem';

/**
 * NewFriendsPanel · 像素古籍风社交面板
 *
 * 4 tab:
 *   - 好友
 *   - 请求 (incoming + outgoing)
 *   - 关注
 *   - 粉丝
 *
 * 加号按钮 → 用户名搜索 + 发好友请求
 *
 * 尺寸 480×560 (跟 NewChatPanel / NewMailBox 一致)
 */

const PANEL_WIDTH = 480;
const PANEL_HEIGHT = 560;

type Tab = 'friends' | 'requests' | 'following' | 'followers';

export function NewFriendsPanel() {
  const [open, setOpen] = useOpenViaEventBus('friends', 'open-friends-panel');
  const [tab, setTab] = useState<Tab>('friends');
  const [showSearch, setShowSearch] = useState(false);

  const myProfile = useProfile();
  const friendsApi = useFriends();
  const followsApi = useFollows();

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

  const incomingCount = friendsApi.requests.incoming.length;

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
          <span style={{ fontSize: 18 }}>👥</span>
          <span className="t-title" style={{ fontSize: 16 }}>
            社交
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <PixelButton
            size="pb-sm"
            onClick={() => setShowSearch(!showSearch)}
          >
            {showSearch ? '✕' : '+ 加好友'}
          </PixelButton>
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
      </div>

      {/* 加好友搜索栏 */}
      {showSearch && (
        <FriendSearchBar
          myUserId={myProfile?.user_id ?? null}
          onSent={() => {
            setShowSearch(false);
            setTab('requests');
          }}
        />
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          background: 'var(--paper-2)',
          borderBottom: '2px solid var(--wood-3)',
        }}
      >
        <TabButton
          label={`好友 ${friendsApi.friends.length > 0 ? `(${friendsApi.friends.length})` : ''}`}
          active={tab === 'friends'}
          onClick={() => setTab('friends')}
        />
        <TabButton
          label="请求"
          active={tab === 'requests'}
          onClick={() => setTab('requests')}
          badge={incomingCount > 0 ? incomingCount : undefined}
        />
        <TabButton
          label={`关注 ${followsApi.following.length > 0 ? `(${followsApi.following.length})` : ''}`}
          active={tab === 'following'}
          onClick={() => setTab('following')}
        />
        <TabButton
          label={`粉丝 ${followsApi.followers.length > 0 ? `(${followsApi.followers.length})` : ''}`}
          active={tab === 'followers'}
          onClick={() => setTab('followers')}
        />
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'friends' && (
          <FriendsTab api={friendsApi} loading={friendsApi.loading} />
        )}
        {tab === 'requests' && (
          <RequestsTab api={friendsApi} loading={friendsApi.loading} />
        )}
        {tab === 'following' && (
          <FollowingTab api={followsApi} loading={followsApi.loading} />
        )}
        {tab === 'followers' && (
          <FollowersTab api={followsApi} loading={followsApi.loading} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tabs
// ============================================================

interface TabButtonProps {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function TabButton({ label, active, badge, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 6px',
        textAlign: 'center',
        fontSize: 11,
        fontFamily: 'var(--f-pixel)',
        cursor: 'pointer',
        background: active ? 'var(--paper-0)' : 'transparent',
        border: 'none',
        borderBottom: active ? '3px solid var(--gold)' : '3px solid transparent',
        color: active ? 'var(--wood-3)' : 'var(--ink)',
        position: 'relative',
        transition: 'all 0.15s',
      }}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            marginLeft: 4,
            background: 'var(--danger)',
            color: '#fff',
            fontSize: 9,
            padding: '1px 4px',
            border: '1px solid var(--wood-4)',
            fontFamily: 'var(--f-num)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ============================================================
// Friends 列表
// ============================================================

function FriendsTab({
  api,
  loading,
}: {
  api: ReturnType<typeof useFriends>;
  loading: boolean;
}) {
  if (loading) return <LoadingState />;
  if (api.friends.length === 0) return <EmptyState icon="👥" text="还没有好友" hint='点 "+ 加好友" 找个伙伴' />;

  return (
    <div>
      {api.friends.map((f) => (
        <FriendItem
          key={f.friend_id}
          displayName={f.display_name}
          username={f.username}
          avatarUrl={f.avatar_url}
          level={f.level}
          levelName={f.level_name}
          totalCV={f.total_cv}
          actions={
            <PixelButton
              size="pb-sm"
              onClick={() => {
                if (confirm(`确定删除好友 ${f.display_name}？`)) {
                  void api.remove(f.friend_id);
                }
              }}
            >
              删除
            </PixelButton>
          }
        />
      ))}
    </div>
  );
}

// ============================================================
// Requests 列表
// ============================================================

function RequestsTab({
  api,
  loading,
}: {
  api: ReturnType<typeof useFriends>;
  loading: boolean;
}) {
  if (loading) return <LoadingState />;
  const total = api.requests.incoming.length + api.requests.outgoing.length;
  if (total === 0) return <EmptyState icon="📩" text="没有未处理请求" />;

  return (
    <div>
      {api.requests.incoming.length > 0 && (
        <>
          <SectionHeader title="收到的" />
          {api.requests.incoming.map((req) => (
            <FriendItem
              key={req.from_user_id}
              displayName={req.display_name}
              username={req.username}
              avatarUrl={req.avatar_url}
              subtitle="想加你为好友"
              actions={
                <>
                  <PixelButton
                    variant="pb-primary"
                    size="pb-sm"
                    onClick={() => void api.accept(req.from_user_id)}
                  >
                    接受
                  </PixelButton>
                  <PixelButton
                    size="pb-sm"
                    onClick={() => void api.reject(req.from_user_id)}
                  >
                    拒绝
                  </PixelButton>
                </>
              }
            />
          ))}
        </>
      )}
      {api.requests.outgoing.length > 0 && (
        <>
          <SectionHeader title="已发送" />
          {api.requests.outgoing.map((req) => (
            <FriendItem
              key={req.to_user_id}
              displayName={req.display_name}
              username={req.username}
              avatarUrl={req.avatar_url}
              subtitle="等待对方回复"
              actions={
                <PixelButton
                  size="pb-sm"
                  onClick={() => void api.cancelRequest(req.to_user_id)}
                >
                  撤回
                </PixelButton>
              }
            />
          ))}
        </>
      )}
    </div>
  );
}

// ============================================================
// Following 列表
// ============================================================

function FollowingTab({
  api,
  loading,
}: {
  api: ReturnType<typeof useFollows>;
  loading: boolean;
}) {
  if (loading) return <LoadingState />;
  if (api.following.length === 0) return <EmptyState icon="⭐" text="还没关注任何人" />;

  return (
    <div>
      {api.following.map((f) => (
        <FriendItem
          key={f.followee_id ?? f.username}
          displayName={f.display_name}
          username={f.username}
          avatarUrl={f.avatar_url}
          level={f.level}
          levelName={f.level_name}
          totalCV={f.total_cv}
          actions={
            <PixelButton
              size="pb-sm"
              onClick={() => {
                if (f.followee_id) void api.unfollow(f.followee_id);
              }}
            >
              取关
            </PixelButton>
          }
        />
      ))}
    </div>
  );
}

// ============================================================
// Followers 列表
// ============================================================

function FollowersTab({
  api,
  loading,
}: {
  api: ReturnType<typeof useFollows>;
  loading: boolean;
}) {
  if (loading) return <LoadingState />;
  if (api.followers.length === 0) return <EmptyState icon="👁" text="还没有粉丝" hint="多发表内容让人关注你" />;

  return (
    <div>
      {api.followers.map((f) => (
        <FriendItem
          key={f.follower_id ?? f.username}
          displayName={f.display_name}
          username={f.username}
          avatarUrl={f.avatar_url}
          level={f.level}
          levelName={f.level_name}
          totalCV={f.total_cv}
        />
      ))}
    </div>
  );
}

// ============================================================
// Friend search bar
// ============================================================

function FriendSearchBar({
  myUserId,
  onSent,
}: {
  myUserId: string | null;
  onSent: () => void;
}) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UserProfile | null>(null);

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setError('');
    setResult(null);
    try {
      const profile = await fetchProfileByUsername(trimmed);
      if (!profile) {
        setError(`找不到用户 "${trimmed}"`);
      } else if (profile.user_id === myUserId) {
        setError('不能加自己为好友');
      } else {
        setResult(profile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!result) return;
    // 直接调 friendsManager · 避免再多一层依赖
    const { friendsManager } = await import('../lib/friendsStore');
    const res = await friendsManager.sendRequest(result.user_id);
    if (res.ok) {
      EventBus.emit('show-toast', { text: `✓ 好友请求已发送给 ${result.display_name}` });
      onSent();
    } else {
      setError(res.error || '发送失败');
    }
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--paper-2)',
        borderBottom: '2px solid var(--wood-3)',
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="搜索用户名加好友..."
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '2px solid var(--wood-4)',
            background: 'var(--paper-0)',
            fontSize: 12,
            fontFamily: 'var(--f-sans)',
            outline: 'none',
          }}
        />
        <PixelButton
          size="pb-sm"
          onClick={() => void search()}
          disabled={searching || !query.trim()}
        >
          🔍
        </PixelButton>
      </div>

      {error && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--danger)',
            marginTop: 6,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: 'var(--paper-0)',
            border: '2px solid var(--wood-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: 'var(--paper-3)',
              border: '2px solid var(--wood-4)',
              padding: 1,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {result.avatar_url && (
              <img
                src={result.avatar_url}
                alt={result.display_name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  imageRendering: 'pixelated',
                }}
              />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-title" style={{ fontSize: 12 }}>
              {result.display_name}
            </div>
            <div className="t-faint mono" style={{ fontSize: 10 }}>
              @{result.username}
            </div>
          </div>
          <PixelButton
            variant="pb-primary"
            size="pb-sm"
            onClick={() => void sendRequest()}
          >
            加好友
          </PixelButton>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 通用空 / 加载状态
// ============================================================

function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        color: 'var(--ink-faint)',
        fontSize: 12,
      }}
    >
      加载中...
    </div>
  );
}

function EmptyState({
  icon,
  text,
  hint,
}: {
  icon: string;
  text: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
        color: 'var(--ink-faint)',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 36 }}>{icon}</div>
      <div>{text}</div>
      {hint && (
        <div className="t-faint" style={{ fontSize: 11 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="t-eyebrow"
      style={{
        padding: '8px 12px',
        background: 'var(--paper-2)',
        fontSize: 10,
        color: 'var(--wood-3)',
        borderBottom: '1px solid var(--wood-2)',
      }}
    >
      {title}
    </div>
  );
}

export default NewFriendsPanel;
