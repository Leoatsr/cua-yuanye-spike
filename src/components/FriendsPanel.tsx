import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EventBus } from '../game/EventBus';
import {
  friendsManager,
  type Friend,
  type FriendRequests,
} from '../lib/friendsStore';
import { friendsPresence } from '../lib/friendsPresence';
import { followsManager, type FollowedUser } from '../lib/followsStore';
import { HAIR_COLOR_HEX, OUTFIT_TINT_HEX } from '../lib/faceStore';

/**
 * G5-A · 好友面板（F 键）
 *
 * 3 tab:
 *   👥 好友
 *   📥 收到的请求
 *   📤 发出的请求
 */

type Tab = 'friends' | 'incoming' | 'outgoing' | 'following' | 'followers';

export function FriendsPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(false);
  // G5-B: 在线好友 ids
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  // G7-A: 关注 / 粉丝
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [followers, setFollowers] = useState<FollowedUser[]>([]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    EventBus.on('open-friends-panel', onOpen);
    return () => {
      EventBus.off('open-friends-panel', onOpen);
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

  // Load on open + tab change + friends-updated
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [f, r, fl, fr] = await Promise.all([
        friendsManager.listFriends(),
        friendsManager.listRequests(),
        followsManager.listFollowing(),
        followsManager.listFollowers(),
      ]);
      if (cancelled) return;
      setFriends(f);
      setRequests(r);
      setFollowing(fl);
      setFollowers(fr);
      setLoading(false);
    };
    void load();
    const onFriendsUpdate = () => void load();
    const onFollowsUpdate = () => void load();
    EventBus.on('friends-updated', onFriendsUpdate);
    EventBus.on('follows-updated', onFollowsUpdate);
    return () => {
      cancelled = true;
      EventBus.off('friends-updated', onFriendsUpdate);
      EventBus.off('follows-updated', onFollowsUpdate);
    };
  }, [open]);

  // G5-B: 同步在线好友
  useEffect(() => {
    if (!open) return;
    setOnlineIds(new Set(friendsPresence.getOnlineCount() > 0 ? friendsPresence.getOnlineFriends().map(f => f.friend_id) : []));

    const onPresence = (data: { online_ids: string[] }) => {
      setOnlineIds(new Set(data.online_ids));
    };
    EventBus.on('friends-presence-updated', onPresence);
    return () => {
      EventBus.off('friends-presence-updated', onPresence);
    };
  }, [open]);

  if (!open) return null;

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
            <div style={{ fontSize: 11, color: '#8a8576', letterSpacing: '0.15em', marginBottom: 2 }}>
              SOCIAL · G5 + G7
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#e0b060' }}>
              社交
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

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(184, 137, 58, 0.2)',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          <TabButton
            label="👥 好友"
            count={friends.length}
            active={activeTab === 'friends'}
            onClick={() => setActiveTab('friends')}
          />
          <TabButton
            label="📥 收到"
            count={requests.incoming.length}
            highlight={requests.incoming.length > 0}
            active={activeTab === 'incoming'}
            onClick={() => setActiveTab('incoming')}
          />
          <TabButton
            label="📤 发出"
            count={requests.outgoing.length}
            active={activeTab === 'outgoing'}
            onClick={() => setActiveTab('outgoing')}
          />
          <TabButton
            label="⭐ 关注"
            count={following.length}
            active={activeTab === 'following'}
            onClick={() => setActiveTab('following')}
          />
          <TabButton
            label="💗 粉丝"
            count={followers.length}
            active={activeTab === 'followers'}
            onClick={() => setActiveTab('followers')}
          />
        </div>

        {/* Body */}
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
          ) : activeTab === 'friends' ? (
            <FriendsListView friends={friends} onlineIds={onlineIds} onClose={() => setOpen(false)} />
          ) : activeTab === 'incoming' ? (
            <IncomingView requests={requests.incoming} />
          ) : activeTab === 'outgoing' ? (
            <OutgoingView requests={requests.outgoing} />
          ) : activeTab === 'following' ? (
            <FollowingView users={following} onClose={() => setOpen(false)} />
          ) : (
            <FollowersView users={followers} onClose={() => setOpen(false)} />
          )}
        </div>
      </div>
    </>
  );
}

function TabButton({
  label,
  count,
  active,
  highlight,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 18px',
        cursor: 'pointer',
        fontSize: 13,
        color: active ? '#e0b060' : '#a8a08e',
        borderBottom: `2px solid ${active ? '#b8893a' : 'transparent'}`,
        background: active ? 'rgba(184, 137, 58, 0.1)' : 'transparent',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {label}
      <span
        style={{
          marginLeft: 6,
          fontSize: 10,
          color: highlight ? '#e07a6e' : active ? '#e0b060' : '#6e6856',
          fontFamily: 'monospace',
          fontWeight: highlight ? 700 : 400,
        }}
      >
        ({count})
      </span>
    </div>
  );
}

// ============================================================================
// Friends list
// ============================================================================
function FriendsListView({
  friends,
  onlineIds,
  onClose,
}: {
  friends: Friend[];
  onlineIds: Set<string>;
  onClose: () => void;
}) {
  if (friends.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
        — 还没有好友 —
        <br />
        <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          点击其他玩家头像或公开页 → "🤝 加好友"
        </span>
      </div>
    );
  }

  // G5-B: 排序——在线的靠前
  const sorted = [...friends].sort((a, b) => {
    const aOnline = onlineIds.has(a.friend_id) ? 1 : 0;
    const bOnline = onlineIds.has(b.friend_id) ? 1 : 0;
    return bOnline - aOnline;
  });
  const onlineCount = sorted.filter((f) => onlineIds.has(f.friend_id)).length;

  return (
    <div>
      {onlineCount > 0 && (
        <div
          style={{
            padding: '6px 18px',
            fontSize: 11,
            color: 'rgba(255, 200, 80, 0.85)',
            background: 'rgba(255, 200, 80, 0.05)',
            borderBottom: '1px solid rgba(184, 137, 58, 0.1)',
            letterSpacing: '0.05em',
          }}
        >
          🟢 在线 {onlineCount} 人 · ⚫ 离线 {friends.length - onlineCount} 人
        </div>
      )}
      {sorted.map((f) => (
        <FriendRow
          key={f.friend_id}
          friend={f}
          online={onlineIds.has(f.friend_id)}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

function FriendRow({
  friend: f,
  online,
  onClose,
}: {
  friend: Friend;
  online: boolean;
  onClose: () => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);

  const outfitTint = OUTFIT_TINT_HEX[f.face?.outfit_color ?? 0] ?? 0xffffff;
  const outfitColor = '#' + outfitTint.toString(16).padStart(6, '0');
  const hairColor = '#' + (HAIR_COLOR_HEX[f.face?.hair_color ?? 0] ?? 0x2a1810).toString(16).padStart(6, '0');

  const handleRemove = async () => {
    if (!confirm(`确定移除好友 ${f.display_name}？`)) return;
    await friendsManager.remove(f.friend_id);
  };

  const handlePrivateChat = () => {
    EventBus.emit('open-private-chat', { otherUserId: f.friend_id });
    onClose();
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto',
        gap: 12,
        padding: '10px 18px',
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* Avatar (use face) */}
      <div
        style={{
          width: 32,
          height: 32,
          background: outfitColor,
          border: online ? '2px solid rgba(255, 200, 80, 0.85)' : '1px solid rgba(0,0,0,0.4)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: online ? '0 0 6px rgba(255, 200, 80, 0.4)' : 'none',
          opacity: online ? 1 : 0.65,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 8,
            right: 8,
            height: 8,
            background: hairColor,
            borderRadius: '50% 50% 0 0',
          }}
        />
      </div>

      <div>
        <div style={{ fontSize: 13, color: '#f5f0e0', fontWeight: 500 }}>
          <span style={{
            marginRight: 6,
            fontSize: 9,
            color: online ? '#7fc090' : '#6e6856',
          }}>
            {online ? '🟢' : '⚫'}
          </span>
          {f.display_name}
          <span style={{ marginLeft: 8, fontSize: 10, color: '#a78bfa' }}>
            L{f.level} {f.level_name}
          </span>
        </div>
        {f.username && (
          <div style={{ fontSize: 10, color: '#6e6856', fontFamily: 'monospace' }}>
            @{f.username} · {f.total_cv.toFixed(0)} CV
            {online && (
              <span style={{ marginLeft: 6, color: '#7fc090' }}>· 在线</span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handlePrivateChat}
          title="私聊"
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: 'rgba(224, 176, 96, 0.15)',
            border: '1px solid rgba(224, 176, 96, 0.4)',
            borderRadius: 3,
            color: '#e0b060',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          💌
        </button>
        {f.username && (
          <Link
            to={`/u/${f.username}`}
            onClick={onClose}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: 'rgba(165, 200, 255, 0.12)',
              border: '1px solid rgba(165, 200, 255, 0.35)',
              borderRadius: 3,
              color: '#a5c8ff',
              cursor: 'pointer',
              textDecoration: 'none',
              fontFamily: 'inherit',
            }}
          >
            📋
          </Link>
        )}
        <button
          onClick={() => setActionsOpen((v) => !v)}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            background: 'transparent',
            border: '1px solid rgba(168, 179, 160, 0.25)',
            borderRadius: 3,
            color: '#a8a08e',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ⋯
        </button>
      </div>

      {actionsOpen && (
        <>
          <div
            onClick={() => setActionsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 110 }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 18,
              marginTop: 4,
              background: 'rgba(20, 24, 30, 0.98)',
              border: '1px solid rgba(184, 137, 58, 0.4)',
              borderRadius: 4,
              padding: 4,
              zIndex: 111,
              minWidth: 140,
            }}
          >
            <div
              onClick={() => {
                void handleRemove();
                setActionsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                color: '#e07a6e',
                cursor: 'pointer',
                borderRadius: 3,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(224, 122, 110, 0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              ✗ 移除好友
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Incoming requests
// ============================================================================
function IncomingView({ requests }: { requests: FriendRequests['incoming'] }) {
  if (requests.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
        — 没有收到的好友请求 —
      </div>
    );
  }

  return (
    <div>
      {requests.map((r) => (
        <IncomingRow key={r.from_user_id} req={r} />
      ))}
    </div>
  );
}

function IncomingRow({ req }: { req: FriendRequests['incoming'][number] }) {
  const [busy, setBusy] = useState(false);

  const handleAccept = async () => {
    setBusy(true);
    await friendsManager.accept(req.from_user_id);
    setBusy(false);
  };
  const handleReject = async () => {
    setBusy(true);
    await friendsManager.reject(req.from_user_id);
    setBusy(false);
  };

  const ago = ((d: string) => {
    const t = new Date(d);
    const min = Math.floor((Date.now() - t.getTime()) / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min} 分钟前`;
    if (min < 1440) return `${Math.floor(min / 60)} 小时前`;
    return `${Math.floor(min / 1440)} 天前`;
  })(req.created_at);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: 10,
        padding: '12px 18px',
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: req.avatar_url
            ? `url(${req.avatar_url}) center/cover`
            : 'linear-gradient(135deg, #b8893a, #6e6856)',
          border: '1px solid rgba(184, 137, 58, 0.3)',
        }}
      />
      <div>
        <div style={{ fontSize: 13, color: '#f5f0e0' }}>{req.display_name}</div>
        <div style={{ fontSize: 10, color: '#6e6856', fontFamily: 'monospace' }}>
          {req.username && `@${req.username} · `}{ago}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => void handleAccept()}
          disabled={busy}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            background: 'rgba(127, 192, 144, 0.2)',
            border: '1px solid rgba(127, 192, 144, 0.5)',
            borderRadius: 3,
            color: '#7fc090',
            cursor: busy ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ✓ 接受
        </button>
        <button
          onClick={() => void handleReject()}
          disabled={busy}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            background: 'transparent',
            border: '1px solid rgba(168, 179, 160, 0.25)',
            borderRadius: 3,
            color: '#a8a08e',
            cursor: busy ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ✗
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Outgoing requests
// ============================================================================
function OutgoingView({ requests }: { requests: FriendRequests['outgoing'] }) {
  if (requests.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
        — 没有发出的好友请求 —
      </div>
    );
  }

  return (
    <div>
      {requests.map((r) => (
        <OutgoingRow key={r.to_user_id} req={r} />
      ))}
    </div>
  );
}

function OutgoingRow({ req }: { req: FriendRequests['outgoing'][number] }) {
  const [busy, setBusy] = useState(false);

  const handleCancel = async () => {
    setBusy(true);
    await friendsManager.cancelRequest(req.to_user_id);
    setBusy(false);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: 10,
        padding: '12px 18px',
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: req.avatar_url
            ? `url(${req.avatar_url}) center/cover`
            : 'linear-gradient(135deg, #b8893a, #6e6856)',
          border: '1px solid rgba(184, 137, 58, 0.3)',
        }}
      />
      <div>
        <div style={{ fontSize: 13, color: '#f5f0e0' }}>{req.display_name}</div>
        <div style={{ fontSize: 10, color: '#6e6856', fontFamily: 'monospace' }}>
          {req.username && `@${req.username}`} · 等待回应
        </div>
      </div>
      <button
        onClick={() => void handleCancel()}
        disabled={busy}
        style={{
          padding: '4px 12px',
          fontSize: 11,
          background: 'transparent',
          border: '1px solid rgba(168, 179, 160, 0.25)',
          borderRadius: 3,
          color: '#a8a08e',
          cursor: busy ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        取消
      </button>
    </div>
  );
}


// ============================================================================
// G7-A · 我关注的人
// ============================================================================
function FollowingView({ users, onClose }: { users: FollowedUser[]; onClose: () => void }) {
  if (users.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
        — 还没有关注任何人 —
        <br />
        <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          访问别人的公开页 → "⭐ 关注"
        </span>
      </div>
    );
  }
  return (
    <div>
      {users.map((u) => (
        <FollowedUserRow
          key={u.followee_id ?? u.follower_id}
          user={u}
          showUnfollow={true}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

// ============================================================================
// G7-A · 我的粉丝
// ============================================================================
function FollowersView({ users, onClose }: { users: FollowedUser[]; onClose: () => void }) {
  if (users.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8a8576', fontStyle: 'italic' }}>
        — 还没有粉丝 —
        <br />
        <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          做更多任务、发更多内容
        </span>
      </div>
    );
  }
  return (
    <div>
      {users.map((u) => (
        <FollowedUserRow
          key={u.follower_id ?? u.followee_id}
          user={u}
          showUnfollow={false}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

function FollowedUserRow({
  user: u,
  showUnfollow,
  onClose,
}: {
  user: FollowedUser;
  showUnfollow: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const userId = u.followee_id ?? u.follower_id ?? '';
  const outfitTint = OUTFIT_TINT_HEX[u.face?.outfit_color ?? 0] ?? 0xffffff;
  const outfitColor = '#' + outfitTint.toString(16).padStart(6, '0');
  const hairColor = '#' + (HAIR_COLOR_HEX[u.face?.hair_color ?? 0] ?? 0x2a1810).toString(16).padStart(6, '0');

  const handleUnfollow = async () => {
    if (!confirm(`取消关注 ${u.display_name}？`)) return;
    setBusy(true);
    await followsManager.unfollow(userId);
    setBusy(false);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto',
        gap: 12,
        padding: '10px 18px',
        borderBottom: '1px solid rgba(184, 137, 58, 0.08)',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          background: outfitColor,
          border: '1px solid rgba(0,0,0,0.4)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 8,
            right: 8,
            height: 8,
            background: hairColor,
            borderRadius: '50% 50% 0 0',
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 13, color: '#f5f0e0', fontWeight: 500 }}>
          {u.display_name}
          <span style={{ marginLeft: 8, fontSize: 10, color: '#a78bfa' }}>
            L{u.level} {u.level_name}
          </span>
        </div>
        {u.username && (
          <div style={{ fontSize: 10, color: '#6e6856', fontFamily: 'monospace' }}>
            @{u.username} · {u.total_cv.toFixed(0)} CV
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {u.username && (
          <Link
            to={`/u/${u.username}`}
            onClick={onClose}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: 'rgba(165, 200, 255, 0.12)',
              border: '1px solid rgba(165, 200, 255, 0.35)',
              borderRadius: 3,
              color: '#a5c8ff',
              cursor: 'pointer',
              textDecoration: 'none',
              fontFamily: 'inherit',
            }}
          >
            📋
          </Link>
        )}
        {showUnfollow && (
          <button
            onClick={() => void handleUnfollow()}
            disabled={busy}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: 'transparent',
              border: '1px solid rgba(168, 179, 160, 0.25)',
              borderRadius: 3,
              color: '#a8a08e',
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.5 : 1,
            }}
          >
            取消关注
          </button>
        )}
      </div>
    </div>
  );
}
