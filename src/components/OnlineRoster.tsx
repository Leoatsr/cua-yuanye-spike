import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EventBus } from '../game/EventBus';
import { HAIR_COLOR_HEX, OUTFIT_TINT_HEX } from '../lib/faceStore';
import type { RemotePlayerInfo } from '../lib/realtimePresence';
import { friendsManager, type FriendStatus } from '../lib/friendsStore';
import { friendsPresence } from '../lib/friendsPresence';

/**
 * G1.0 · 左上角在线人数 + 迷你头像列表
 * - 第一行："在线 全X / 此地Y"
 * - 第二行：当前 scene 玩家迷你头像（最多 8 个）
 */
export function OnlineRoster() {
  const [count, setCount] = useState({ global: 1, scene: 1 });
  const [roster, setRoster] = useState<RemotePlayerInfo[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<RemotePlayerInfo | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  // G5-B: 好友 ids（用于头像金边）+ 在线好友数
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [onlineFriendCount, setOnlineFriendCount] = useState(0);

  useEffect(() => {
    const onCount = (data: { global: number; scene: number }) => {
      setCount(data);
    };
    const onRoster = (list: RemotePlayerInfo[]) => {
      setRoster(list);
    };
    EventBus.on('online-count-updated', onCount);
    EventBus.on('roster-updated', onRoster);
    return () => {
      EventBus.off('online-count-updated', onCount);
      EventBus.off('roster-updated', onRoster);
    };
  }, []);

  // G5-A: 拉 selectedPlayer 的好友关系
  useEffect(() => {
    if (!selectedPlayer || selectedPlayer.user_id.startsWith('bot-')) {
      setFriendStatus('none');
      return;
    }
    let cancelled = false;
    void friendsManager.getStatus(selectedPlayer.user_id).then((s) => {
      if (!cancelled) setFriendStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPlayer]);

  // G5-A: 监听 friends-updated 重新拉
  useEffect(() => {
    const onUpdate = () => {
      if (selectedPlayer && !selectedPlayer.user_id.startsWith('bot-')) {
        friendsManager.invalidateCache(selectedPlayer.user_id);
        void friendsManager.getStatus(selectedPlayer.user_id).then(setFriendStatus);
      }
    };
    EventBus.on('friends-updated', onUpdate);
    return () => {
      EventBus.off('friends-updated', onUpdate);
    };
  }, [selectedPlayer]);

  // G5-B: 同步好友 ids + 在线好友计数
  useEffect(() => {
    // 初始
    setFriendIds(new Set(friendsPresence.getFriendIds()));
    setOnlineFriendCount(friendsPresence.getOnlineCount());

    const onPresenceUpdate = (data: { online_count: number; online_ids: string[] }) => {
      setOnlineFriendCount(data.online_count);
    };
    const onFriendsUpdate = () => {
      // friendsPresence 内部会刷新，等它做完再读
      setTimeout(() => {
        setFriendIds(new Set(friendsPresence.getFriendIds()));
        setOnlineFriendCount(friendsPresence.getOnlineCount());
      }, 200);
    };

    EventBus.on('friends-presence-updated', onPresenceUpdate);
    EventBus.on('friends-updated', onFriendsUpdate);
    return () => {
      EventBus.off('friends-presence-updated', onPresenceUpdate);
      EventBus.off('friends-updated', onFriendsUpdate);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      background: 'rgba(20, 24, 30, 0.85)',
      border: '1px solid rgba(127, 192, 144, 0.3)',
      borderRadius: 4,
      padding: '6px 14px',
      backdropFilter: 'blur(4px)',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
      color: '#f5f0e0',
      userSelect: 'none',
      maxWidth: 380,
    }}>
      <div style={{
        fontSize: 11, color: '#a8b3a0',
        letterSpacing: '0.05em',
        marginBottom: roster.length > 0 ? 6 : 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#7fc090',
          boxShadow: '0 0 4px #7fc090',
        }} />
        <span>
          在线 <strong style={{ color: '#7fc090' }}>{count.global}</strong>
          <span style={{ color: '#6e6856', margin: '0 4px' }}>/</span>
          此地 <strong style={{ color: '#e0b060' }}>{count.scene}</strong>
          {onlineFriendCount > 0 && (
            <>
              <span style={{ color: '#6e6856', margin: '0 4px' }}>·</span>
              <span title="在线好友" style={{ color: 'rgba(255, 200, 80, 0.95)' }}>
                🤝 <strong>{onlineFriendCount}</strong>
              </span>
            </>
          )}
        </span>
      </div>
      {roster.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          marginTop: 4,
          justifyContent: 'center',
        }}>
          {roster.slice(0, 8).map((p) => (
            <MiniAvatar
              key={p.user_id}
              player={p}
              onClick={() => setSelectedPlayer(p)}
              isFriend={friendIds.has(p.user_id)}
            />
          ))}
          {roster.length > 8 && (
            <div style={{
              width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#a8a08e',
              background: 'rgba(168, 179, 160, 0.05)',
              border: '1px solid rgba(168, 179, 160, 0.2)',
              borderRadius: 3,
            }}>
              +{roster.length - 8}
            </div>
          )}
        </div>
      )}

      {/* G2-C: player action menu (private chat / view profile) */}
      {selectedPlayer && (
        <>
          <div
            onClick={() => setSelectedPlayer(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 51,
              background: 'transparent',
            }}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 8,
            minWidth: 200,
            background: 'rgba(20, 24, 30, 0.98)',
            border: '1px solid rgba(184, 137, 58, 0.4)',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            padding: 6,
            zIndex: 52,
          }}>
            <div style={{
              padding: '8px 10px', fontSize: 12,
              color: '#a8b3a0',
              borderBottom: '1px solid rgba(245, 240, 224, 0.06)',
              marginBottom: 4,
            }}>
              {selectedPlayer.display_name}
              {selectedPlayer.user_id.startsWith('bot-') && (
                <span style={{ color: '#a78bfa', fontSize: 10, marginLeft: 6 }}>
                  (机器人)
                </span>
              )}
            </div>
            {/* View public profile (skip for bots) */}
            {!selectedPlayer.user_id.startsWith('bot-') && (
              <Link
                to={`/u/${selectedPlayer.username}`}
                onClick={() => setSelectedPlayer(null)}
                style={{
                  display: 'block',
                  padding: '8px 10px', fontSize: 12,
                  color: '#a5c8ff', cursor: 'pointer',
                  borderRadius: 4, textDecoration: 'none',
                  marginBottom: 2,
                }}
              >
                📋 查看主页
              </Link>
            )}
            {/* Private chat (skip for bots) */}
            {!selectedPlayer.user_id.startsWith('bot-') && (
              <div
                onClick={() => {
                  EventBus.emit('open-private-chat', { otherUserId: selectedPlayer.user_id });
                  setSelectedPlayer(null);
                }}
                style={{
                  padding: '8px 10px', fontSize: 12,
                  color: '#e0b060', cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                💌 私聊
              </div>
            )}
            {/* G5-A: Friend action (skip for bots) */}
            {!selectedPlayer.user_id.startsWith('bot-') && (
              <FriendButton
                userId={selectedPlayer.user_id}
                status={friendStatus}
                onAction={() => setSelectedPlayer(null)}
              />
            )}
            {selectedPlayer.user_id.startsWith('bot-') && (
              <div style={{
                padding: '8px 10px', fontSize: 11,
                color: '#6e6856', fontStyle: 'italic',
              }}>
                机器人不接受私聊
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MiniAvatar({
  player,
  onClick,
  isFriend = false,
}: {
  player: RemotePlayerInfo;
  onClick: () => void;
  isFriend?: boolean;
}) {
  const outfitTint = OUTFIT_TINT_HEX[player.face.outfit_color] ?? 0xffffff;
  const outfitColor = player.face.outfit_color === 0
    ? '#4878c8'
    : '#' + outfitTint.toString(16).padStart(6, '0');
  const hairColor = '#' + (HAIR_COLOR_HEX[player.face.hair_color] ?? 0x2a1810).toString(16).padStart(6, '0');

  // G5-B: 好友头像金边 + 微光
  const friendBorder = isFriend
    ? '2px solid rgba(255, 200, 80, 0.85)'
    : '1px solid rgba(0,0,0,0.4)';
  const friendShadow = isFriend
    ? '0 0 6px rgba(255, 200, 80, 0.5)'
    : 'none';

  return (
    <div
      onClick={onClick}
      title={player.display_name + (isFriend ? ' · 好友' : '')}
      style={{
        width: 24, height: 24, position: 'relative',
        background: outfitColor,
        border: friendBorder,
        borderRadius: 3,
        overflow: 'hidden',
        flexShrink: 0,
        cursor: 'pointer',
        boxShadow: friendShadow,
        transition: 'transform 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.1)';
        if (!isFriend) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255, 215, 0, 0.6)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
        if (!isFriend) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.4)';
        }
      }}
    >
      {/* Skin (head area) */}
      <div style={{
        position: 'absolute', top: 1, left: 4, right: 4, height: 11,
        background: '#eacba0',
      }} />
      {/* Hair */}
      {player.face.hairstyle !== 0 && (
        <div style={{
          position: 'absolute', top: 1, left: 4, right: 4, height: 5,
          background: hairColor,
        }} />
      )}
      {/* Eyes */}
      <div style={{
        position: 'absolute', top: 6, left: 7, width: 2, height: 2,
        background: '#000',
      }} />
      <div style={{
        position: 'absolute', top: 6, right: 7, width: 2, height: 2,
        background: '#000',
      }} />
    </div>
  );
}

// G5-A: 好友按钮（菜单内）
function FriendButton({
  userId,
  status,
  onAction,
}: {
  userId: string;
  status: FriendStatus;
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    setBusy(true);
    const r = await friendsManager.sendRequest(userId);
    setBusy(false);
    if (r.ok) onAction();
    else alert('发送失败：' + (r.error ?? '未知'));
  };
  const handleAccept = async () => {
    setBusy(true);
    await friendsManager.accept(userId);
    setBusy(false);
    onAction();
  };
  const handleCancel = async () => {
    setBusy(true);
    await friendsManager.cancelRequest(userId);
    setBusy(false);
    onAction();
  };
  const handleRemove = async () => {
    if (!confirm('确定移除好友？')) return;
    setBusy(true);
    await friendsManager.remove(userId);
    setBusy(false);
    onAction();
  };

  if (status === 'self' || status === 'none') {
    return (
      <div
        onClick={busy ? undefined : () => void handleSend()}
        style={{
          padding: '8px 10px',
          fontSize: 12,
          color: status === 'self' ? '#6e6856' : '#7fc090',
          cursor: status === 'self' || busy ? 'default' : 'pointer',
          borderRadius: 4,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {status === 'self' ? '— 你自己 —' : busy ? '处理中...' : '🤝 加好友'}
      </div>
    );
  }

  if (status === 'request_sent') {
    return (
      <div
        onClick={busy ? undefined : () => void handleCancel()}
        style={{
          padding: '8px 10px',
          fontSize: 12,
          color: '#a8a08e',
          cursor: busy ? 'default' : 'pointer',
          borderRadius: 4,
          opacity: busy ? 0.5 : 1,
        }}
      >
        ⏳ 请求已发送 (点击取消)
      </div>
    );
  }

  if (status === 'request_received') {
    return (
      <div
        onClick={busy ? undefined : () => void handleAccept()}
        style={{
          padding: '8px 10px',
          fontSize: 12,
          color: '#7fc090',
          cursor: busy ? 'default' : 'pointer',
          borderRadius: 4,
          opacity: busy ? 0.5 : 1,
        }}
      >
        ✓ 接受好友请求
      </div>
    );
  }

  if (status === 'friends') {
    return (
      <div
        onClick={busy ? undefined : () => void handleRemove()}
        style={{
          padding: '8px 10px',
          fontSize: 12,
          color: '#e07a6e',
          cursor: busy ? 'default' : 'pointer',
          borderRadius: 4,
          opacity: busy ? 0.5 : 1,
        }}
      >
        🤝 已是好友 (点击移除)
      </div>
    );
  }

  return null;
}
