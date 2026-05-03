import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchProfileByUsername, lookupUsernameHistory, type UserProfile } from '../lib/profileStore';
import { getSupabase } from '../lib/supabase';
import { EventBus } from '../game/EventBus';
import {
  fetchUserPublicHistory,
  sourceLabel,
  sourceColor,
  type PublicHistoryEntry,
} from '../lib/questHistoryStore';
import { friendsManager, type FriendStatus } from '../lib/friendsStore';
import { followsManager, type FollowStats } from '../lib/followsStore';

type Status = 'loading' | 'not_found' | 'private' | 'unauthorized' | 'ok';

interface UserStats {
  total_cv: number;
  task_count: number;
  proposal_count: number;
  level: number;
  level_name: string;
}


/**
 * F4.2 · 公开页 /u/:username
 *
 * - Authenticated users only (per Q5: 仅登录可见)
 * - Shows: avatar, display_name, bio, level, stats, workshops, links, skills, interests, location, joined_at
 * - Respects visibility: if private and not self, shows "private" message
 */
export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  // D9-C: 公开任务史
  const [history, setHistory] = useState<PublicHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // G5-A: 好友关系
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [friendBusy, setFriendBusy] = useState(false);
  // G7-A: 关注关系
  const [followStats, setFollowStats] = useState<FollowStats | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      const supabase = getSupabase();
      if (!supabase) {
        if (!cancelled) setStatus('unauthorized');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setStatus('unauthorized');
        return;
      }

      if (!username) {
        if (!cancelled) setStatus('not_found');
        return;
      }

      let data = await fetchProfileByUsername(username);

      // F4.3c: not found — try username history (redirect from old name)
      if (!data && !cancelled) {
        const currentUsername = await lookupUsernameHistory(username);
        if (currentUsername && currentUsername.toLowerCase() !== username.toLowerCase()) {
          // Redirect to current username
          navigate(`/u/${currentUsername}`, { replace: true });
          return;
        }
      }

      if (cancelled) return;

      if (!data) {
        setStatus('not_found');
        return;
      }

      const me = session.user.id === data.user_id;
      setIsMe(me);

      // Visibility check
      if (data.visibility === 'private' && !me) {
        setProfile(data);
        setStatus('private');
        return;
      }

      setProfile(data);
      setStatus('ok');

      // Fetch level & stats (best-effort)
      try {
        const { data: levelData } = await supabase.rpc('get_user_level', { p_user_id: data.user_id });
        const row = (levelData as Array<UserStats>)?.[0];
        if (row && !cancelled) {
          setStats(row);
        }
      } catch {
        // ignore
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [username, navigate]);

  // D9-C: 加载公开任务史（profile 加载完后）
  useEffect(() => {
    if (!profile?.username) return;
    let cancelled = false;
    setHistoryLoading(true);
    void fetchUserPublicHistory(profile.username, 30).then((entries) => {
      if (cancelled) return;
      setHistory(entries);
      setHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile?.username]);

  // G5-A: 加载好友关系
  useEffect(() => {
    if (!profile?.user_id || isMe) {
      setFriendStatus('none');
      return;
    }
    let cancelled = false;
    void friendsManager.getStatus(profile.user_id).then((s) => {
      if (!cancelled) setFriendStatus(s);
    });
    const onUpdate = () => {
      if (profile?.user_id) {
        friendsManager.invalidateCache(profile.user_id);
        void friendsManager.getStatus(profile.user_id).then((s) => {
          if (!cancelled) setFriendStatus(s);
        });
      }
    };
    EventBus.on('friends-updated', onUpdate);
    return () => {
      cancelled = true;
      EventBus.off('friends-updated', onUpdate);
    };
  }, [profile?.user_id, isMe]);

  // G7-A: 加载关注 stats
  useEffect(() => {
    if (!profile?.user_id) {
      setFollowStats(null);
      return;
    }
    let cancelled = false;
    void followsManager.getStats(profile.user_id).then((s) => {
      if (!cancelled) setFollowStats(s);
    });
    const onUpdate = () => {
      if (profile?.user_id) {
        followsManager.invalidateCache(profile.user_id);
        void followsManager.getStats(profile.user_id).then((s) => {
          if (!cancelled) setFollowStats(s);
        });
      }
    };
    EventBus.on('follows-updated', onUpdate);
    return () => {
      cancelled = true;
      EventBus.off('follows-updated', onUpdate);
    };
  }, [profile?.user_id]);

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--paper-0, #fff8dc)',
    backgroundImage:
      'radial-gradient(circle at 20% 30%, var(--paper-2, #f5deb3) 1.5px, transparent 1.5px), radial-gradient(circle at 70% 60%, var(--paper-2, #f5deb3) 1.5px, transparent 1.5px)',
    backgroundSize: '24px 24px',
    color: 'var(--ink, #3a2a1a)',
    fontFamily: 'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
    padding: '40px 24px',
  };

  if (status === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: 40, color: '#8a8576' }}>
          加载中...
        </div>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return (
      <div style={containerStyle}>
        <CenteredCard>
          <h2 style={{ color: 'var(--danger, #a32d2d)', margin: '0 0 12px', fontFamily: 'var(--f-title)' }}>需要登录</h2>
          <p style={{ color: 'var(--ink-soft, #6b4f33)', margin: '0 0 18px' }}>
            CUA 玩家资料仅对已登录的成员开放。
          </p>
          <Link to="/" style={linkBtnStyle}>返回主页</Link>
        </CenteredCard>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div style={containerStyle}>
        <CenteredCard>
          <h2 style={{ color: 'var(--danger, #a32d2d)', margin: '0 0 12px', fontFamily: 'var(--f-title)' }}>未找到玩家</h2>
          <p style={{ color: 'var(--ink-soft, #6b4f33)', margin: '0 0 18px' }}>
            <code style={{ color: 'var(--wood-3, #8b4513)', background: 'var(--paper-2, #f5deb3)', padding: '2px 6px', border: '1px solid var(--paper-shadow, #c9a55b)', fontFamily: 'var(--f-pixel)' }}>
              {username ?? '(empty)'}
            </code>{' '}
            不存在或尚未设置资料。
          </p>
          <Link to="/" style={linkBtnStyle}>返回主页</Link>
        </CenteredCard>
      </div>
    );
  }

  if (status === 'private' && profile) {
    return (
      <div style={containerStyle}>
        <CenteredCard>
          <h2 style={{ color: 'var(--ink-soft, #6b4f33)', margin: '0 0 12px', fontFamily: 'var(--f-title)' }}>🔒 此玩家资料私密</h2>
          <p style={{ color: 'var(--ink-soft, #6b4f33)', margin: '0 0 18px' }}>
            <strong style={{ color: 'var(--ink, #3a2a1a)' }}>{profile.display_name}</strong> 选择不公开资料。
          </p>
          <Link to="/" style={linkBtnStyle}>返回主页</Link>
        </CenteredCard>
      </div>
    );
  }

  if (!profile) return null;

  const lv = stats?.level ?? 0;

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Top nav · Wave 7.E.2 像素风 */}
        <div style={{
          marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12,
        }}>
          <Link to="/" style={{
            fontSize: 12,
            color: 'var(--wood-3, #8b4513)',
            textDecoration: 'none',
            letterSpacing: '0.1em',
            fontFamily: 'var(--f-pixel, "Courier New", monospace)',
            padding: '6px 12px',
            background: 'var(--paper-1, #fdf0cf)',
            border: '2px solid var(--wood-3, #8b4513)',
            boxShadow: '0 0 0 2px var(--wood-4, #5d3a1a), inset -1px -1px 0 var(--paper-shadow, #c9a55b)',
            display: 'inline-block',
          }}>
            ← 回 CUA 基地
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMe && (
              <span style={{
                fontSize: 11,
                color: 'var(--gold, #daa520)',
                fontStyle: 'italic',
                fontFamily: 'var(--f-pixel, "Courier New", monospace)',
              }}>
                你的公开页 · 按 P 修改
              </span>
            )}
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopyStatus('copied');
                  setTimeout(() => setCopyStatus('idle'), 2000);
                } catch {
                  setCopyStatus('error');
                  setTimeout(() => setCopyStatus('idle'), 2000);
                }
              }}
              style={{
                padding: '6px 12px', fontSize: 11,
                background: copyStatus === 'copied'
                  ? 'var(--paper-2, #f5deb3)'
                  : 'var(--paper-1, #fdf0cf)',
                color: copyStatus === 'copied' ? '#0f6e56' : 'var(--wood-3, #8b4513)',
                border: '2px solid var(--wood-3, #8b4513)',
                boxShadow: '0 0 0 2px var(--wood-4, #5d3a1a), inset -1px -1px 0 var(--paper-shadow, #c9a55b)',
                cursor: 'pointer',
                fontFamily: 'var(--f-pixel, "Courier New", monospace)',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}
              title="复制公开页 URL"
            >
              {copyStatus === 'copied' ? '✓ 已复制' :
               copyStatus === 'error' ? '× 复制失败' :
               '📋 复制链接'}
            </button>
            {/* G2-D: private chat button (other users only) */}
            {!isMe && profile && (
              <button
                onClick={() => {
                  EventBus.emit('open-private-chat', { otherUserId: profile.user_id });
                  navigate('/');
                }}
                style={{
                  padding: '6px 12px', fontSize: 11,
                  background: 'var(--paper-1, #fdf0cf)',
                  color: 'var(--gold, #daa520)',
                  border: '2px solid var(--wood-3, #8b4513)',
                  boxShadow: '0 0 0 2px var(--wood-4, #5d3a1a), inset -1px -1px 0 var(--paper-shadow, #c9a55b)', cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
                title={`私聊 ${profile.display_name}`}
              >
                💌 私聊
              </button>
            )}
            {/* G5-A: friend button (other users only) */}
            {!isMe && profile && (
              <button
                onClick={async () => {
                  if (friendBusy) return;
                  setFriendBusy(true);
                  if (friendStatus === 'none') {
                    const r = await friendsManager.sendRequest(profile.user_id);
                    if (!r.ok) alert('发送失败：' + (r.error ?? '未知'));
                  } else if (friendStatus === 'request_sent') {
                    await friendsManager.cancelRequest(profile.user_id);
                  } else if (friendStatus === 'request_received') {
                    await friendsManager.accept(profile.user_id);
                  } else if (friendStatus === 'friends') {
                    if (confirm(`移除好友 ${profile.display_name}？`)) {
                      await friendsManager.remove(profile.user_id);
                    }
                  }
                  setFriendBusy(false);
                }}
                disabled={friendBusy}
                style={{
                  padding: '5px 12px', fontSize: 11,
                  background:
                    friendStatus === 'friends'
                      ? 'rgba(127, 192, 144, 0.18)'
                      : friendStatus === 'request_sent'
                        ? 'rgba(168, 179, 160, 0.08)'
                        : friendStatus === 'request_received'
                          ? 'rgba(127, 192, 144, 0.18)'
                          : 'rgba(127, 192, 144, 0.12)',
                  color:
                    friendStatus === 'friends'
                      ? '#7fc090'
                      : friendStatus === 'request_sent'
                        ? '#a8a08e'
                        : '#7fc090',
                  border: `1px solid ${
                    friendStatus === 'friends'
                      ? 'rgba(127, 192, 144, 0.5)'
                      : friendStatus === 'request_sent'
                        ? 'rgba(168, 179, 160, 0.3)'
                        : 'rgba(127, 192, 144, 0.4)'
                  }`,
                  borderRadius: 3, cursor: friendBusy ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  opacity: friendBusy ? 0.5 : 1,
                }}
              >
                {friendStatus === 'friends'
                  ? '🤝 已是好友'
                  : friendStatus === 'request_sent'
                    ? '⏳ 已发请求'
                    : friendStatus === 'request_received'
                      ? '✓ 接受请求'
                      : '🤝 加好友'}
              </button>
            )}
            {/* G7-A: follow button (other users only) */}
            {!isMe && profile && followStats && (
              <button
                onClick={async () => {
                  if (followBusy) return;
                  setFollowBusy(true);
                  if (followStats.i_follow_them) {
                    if (confirm(`取消关注 ${profile.display_name}？`)) {
                      await followsManager.unfollow(profile.user_id);
                    }
                  } else {
                    const r = await followsManager.follow(profile.user_id);
                    if (!r.ok) alert('关注失败：' + (r.error ?? '未知'));
                  }
                  setFollowBusy(false);
                }}
                disabled={followBusy}
                style={{
                  padding: '5px 12px', fontSize: 11,
                  background: followStats.i_follow_them
                    ? 'rgba(167, 139, 250, 0.18)'
                    : 'rgba(244, 168, 192, 0.15)',
                  color: followStats.i_follow_them ? '#a78bfa' : '#f4a8c0',
                  border: `1px solid ${
                    followStats.i_follow_them
                      ? 'rgba(167, 139, 250, 0.5)'
                      : 'rgba(244, 168, 192, 0.4)'
                  }`,
                  borderRadius: 3,
                  cursor: followBusy ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  opacity: followBusy ? 0.5 : 1,
                }}
              >
                {followStats.i_follow_them
                  ? followStats.they_follow_me
                    ? '⭐ 已互关'
                    : '⭐ 已关注'
                  : followStats.they_follow_me
                    ? '⭐ 关注 (TA 已关注你)'
                    : '⭐ 关注'}
              </button>
            )}
            <button
              disabled
              style={{
                padding: '5px 12px', fontSize: 11,
                background: 'rgba(168, 179, 160, 0.05)',
                color: '#6e6856',
                border: '1px solid rgba(168, 179, 160, 0.15)',
                borderRadius: 3, cursor: 'not-allowed',
                fontFamily: 'inherit',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}
              title="即将推出"
            >
              📷 截图（即将）
            </button>
          </div>
        </div>

        {/* Hero card · Wave 7.E.2 像素风 */}
        <div style={{
          background: 'var(--paper-1, #fdf0cf)',
          border: '4px solid var(--wood-3, #8b4513)',
          boxShadow: '0 0 0 4px var(--wood-4, #5d3a1a), inset 0 0 0 3px var(--paper-3, #e8c98a), 6px 6px 0 0 rgba(60, 30, 10, 0.25)',
          padding: '32px 36px',
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* Avatar — 方形像素框 */}
            <div style={{
              width: 100, height: 100,
              background: 'var(--paper-3, #e8c98a)',
              border: `3px solid var(--wood-4, #5d3a1a)`,
              padding: 3,
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="头像"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--wood-2, #a0522d)',
                  color: 'var(--paper-0, #fff8dc)',
                  fontSize: 36,
                  fontFamily: 'var(--f-pixel, "Courier New", monospace)',
                  fontWeight: 700,
                }}>
                  {profile.display_name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
                fontSize: 28, fontWeight: 700,
                color: 'var(--ink, #3a2a1a)', marginBottom: 4,
                letterSpacing: '0.02em',
                textShadow: '2px 2px 0 var(--paper-3, #e8c98a)',
              }}>
                {profile.display_name}
              </div>
              <div style={{
                fontSize: 13, color: 'var(--wood-2, #a0522d)',
                fontFamily: 'var(--f-pixel, "Courier New", monospace)',
                marginBottom: 12,
                letterSpacing: '0.05em',
              }}>
                @{profile.username}
              </div>
              {/* Level badge — 像素风 */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '5px 12px',
                  background: 'var(--paper-2, #f5deb3)',
                  border: '2px solid var(--wood-3, #8b4513)',
                  boxShadow: 'inset -1px -1px 0 var(--paper-shadow, #c9a55b)',
                  fontSize: 11,
                  color: 'var(--wood-3, #8b4513)',
                  fontFamily: 'var(--f-pixel, "Courier New", monospace)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  L{lv} · {stats?.level_name ?? '新人'}
                </span>
              </div>
            </div>
          </div>

          {/* G7-A: 关注 / 粉丝 计数 · 像素风 */}
          {followStats && (
            <div style={{
              marginTop: 14,
              display: 'flex',
              gap: 18,
              fontSize: 12,
              color: 'var(--ink-soft, #6b4f33)',
              letterSpacing: '0.05em',
              fontFamily: 'var(--f-pixel, "Courier New", monospace)',
            }}>
              <span>
                <strong style={{ color: 'var(--gold, #daa520)', fontFamily: 'var(--f-pixel)', fontSize: 16, fontWeight: 700 }}>
                  {followStats.following_count}
                </strong>
                <span style={{ marginLeft: 4 }}>关注</span>
              </span>
              <span>
                <strong style={{ color: 'var(--wood-3, #8b4513)', fontFamily: 'var(--f-pixel)', fontSize: 16, fontWeight: 700 }}>
                  {followStats.followers_count}
                </strong>
                <span style={{ marginLeft: 4 }}>粉丝</span>
              </span>
            </div>
          )}

          {/* Bio · 古籍引言风 */}
          {profile.bio && (
            <div style={{
              marginTop: 20, padding: '14px 18px',
              background: 'var(--paper-2, #f5deb3)',
              borderLeft: '4px solid var(--gold, #daa520)',
              fontSize: 14, color: 'var(--ink, #3a2a1a)',
              lineHeight: 1.7,
              fontStyle: 'italic',
              fontFamily: 'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
            }}>
              "{profile.bio}"
            </div>
          )}

          {/* Stats grid */}
          {stats && (
            <div style={{
              marginTop: 20,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
            }}>
              <Stat label="CV" value={Math.round(stats.total_cv).toLocaleString()} />
              <Stat label="任务" value={stats.task_count.toString()} />
              <Stat label="提案" value={stats.proposal_count.toString()} />
            </div>
          )}
        </div>

        {/* Workshops */}
        {profile.workshops.length > 0 && (
          <Section title="所属工作组">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {profile.workshops.map((w) => (
                <span key={w} style={chipStyle}>{w}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Skills */}
        {profile.skills.length > 0 && (
          <Section title="技能">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.skills.map((s) => (
                <span key={s} style={tagStyle('#a5c8ff', '#3a4a6a')}>
                  {s}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Interests */}
        {profile.interests.length > 0 && (
          <Section title="兴趣">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.interests.map((i) => (
                <span key={i} style={tagStyle('#c8a5ff', '#4a3a6a')}>
                  {i}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Links · 像素风 */}
        {profile.links.length > 0 && (
          <Section title="链接">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {profile.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 13,
                    color: 'var(--wood-3, #8b4513)',
                    textDecoration: 'none',
                    padding: '8px 12px',
                    background: 'var(--paper-1, #fdf0cf)',
                    border: '2px solid var(--wood-3, #8b4513)',
                    boxShadow: '0 0 0 2px var(--wood-4, #5d3a1a), inset -1px -1px 0 var(--paper-shadow, #c9a55b)',
                    fontFamily: 'var(--f-pixel, "Courier New", monospace)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{
                    fontWeight: 700,
                    fontFamily: 'var(--f-title, "Songti SC", serif)',
                    color: 'var(--ink, #3a2a1a)',
                    minWidth: 60,
                  }}>
                    {link.name || '(未命名)'}
                  </span>
                  <span style={{
                    flex: 1, color: 'var(--ink-faint, #9c7c54)', fontSize: 11,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {link.url}
                  </span>
                  <span style={{ color: 'var(--gold, #daa520)' }}>↗</span>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* D9-C: 公开任务史 */}
        {(historyLoading || history.length > 0) && (
          <Section title={`📜 任务史 ${history.length > 0 ? `(${history.length})` : ''}`}>
            {historyLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#8a8576', fontStyle: 'italic', fontSize: 12 }}>
                载入中...
              </div>
            ) : (
              <div>
                {history.slice(0, 15).map((e) => {
                  const t = new Date(e.submitted_at);
                  const dateStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                  const sLabel = sourceLabel(e.source);
                  const sColor = sourceColor(e.source);
                  return (
                    <div
                      key={e.submission_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '95px 1fr auto',
                        gap: 10,
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(184, 137, 58, 0.1)',
                        alignItems: 'center',
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: '#6e6856',
                          fontFamily: 'monospace',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {dateStr}
                      </div>
                      <div>
                        <div style={{ color: '#f5f0e0', marginBottom: 2 }}>
                          {e.quest_title}
                        </div>
                        <div style={{ fontSize: 10, color: '#8a8576' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0 5px',
                              background: `${sColor}22`,
                              color: sColor,
                              borderRadius: 2,
                              border: `1px solid ${sColor}55`,
                              marginRight: 6,
                            }}
                          >
                            {sLabel}
                          </span>
                          {e.workshop && e.workshop !== '其他' && (
                            <span>{e.workshop}</span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          color: '#7fc090',
                          fontWeight: 600,
                          fontSize: 12,
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        +{e.cv_amount.toFixed(0)} CV
                      </div>
                    </div>
                  );
                })}
                {history.length > 15 && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      color: '#6e6856',
                      textAlign: 'center',
                      fontStyle: 'italic',
                    }}
                  >
                    ▮ 仅显示最近 15 条 · 完整记录需游戏内按 H 查看
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Footer · 像素风 */}
        <div style={{
          marginTop: 28, padding: '14px 18px',
          background: 'var(--paper-1, #fdf0cf)',
          border: '2px solid var(--wood-3, #8b4513)',
          boxShadow: '0 0 0 2px var(--wood-4, #5d3a1a)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11,
          color: 'var(--ink-soft, #6b4f33)',
          fontFamily: 'var(--f-pixel, "Courier New", monospace)',
          letterSpacing: '0.05em',
        }}>
          <span>
            {profile.location ? `📍 ${profile.location}` : ' '}
          </span>
          <span>
            加入：{new Date(profile.joined_at).toLocaleDateString('zh-CN')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============== Sub-components ==============

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: 480, margin: '80px auto 0',
      padding: '40px 36px',
      background: 'var(--paper-1, #fdf0cf)',
      border: '4px solid var(--wood-3, #8b4513)',
      boxShadow: '0 0 0 4px var(--wood-4, #5d3a1a), inset 0 0 0 3px var(--paper-3, #e8c98a), 6px 6px 0 0 rgba(60, 30, 10, 0.25)',
      textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.2em',
        color: 'var(--wood-2, #a0522d)',
        marginBottom: 12,
        fontFamily: 'var(--f-pixel, "Courier New", monospace)',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        ▎ {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '14px 8px',
      background: 'var(--paper-2, #f5deb3)',
      border: '3px solid var(--wood-3, #8b4513)',
      boxShadow: 'inset -1px -1px 0 var(--paper-shadow, #c9a55b), inset 1px 1px 0 var(--paper-0, #fff8dc)',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 24, fontWeight: 700,
        color: 'var(--wood-3, #8b4513)',
        fontFamily: 'var(--f-pixel, "Courier New", monospace)',
        textShadow: '1px 1px 0 var(--paper-0, #fff8dc)',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10,
        color: 'var(--ink-soft, #6b4f33)',
        letterSpacing: '0.15em',
        marginTop: 4,
        textTransform: 'uppercase',
        fontFamily: 'var(--f-pixel, "Courier New", monospace)',
      }}>
        {label}
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--paper-2, #f5deb3)',
  border: '2px solid var(--wood-3, #8b4513)',
  boxShadow: 'inset -1px -1px 0 var(--paper-shadow, #c9a55b)',
  fontSize: 12,
  color: 'var(--wood-3, #8b4513)',
  fontFamily: 'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
  fontWeight: 500,
};

const tagStyle = (_color: string, _border: string): React.CSSProperties => ({
  padding: '5px 12px',
  background: 'var(--paper-1, #fdf0cf)',
  border: '2px solid var(--wood-2, #a0522d)',
  boxShadow: 'inset -1px -1px 0 var(--paper-shadow, #c9a55b)',
  fontSize: 11,
  color: 'var(--wood-3, #8b4513)',
  fontFamily: 'var(--f-pixel, "Courier New", monospace)',
  letterSpacing: '0.05em',
});

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 24px',
  background: 'var(--paper-1, #fdf0cf)',
  color: 'var(--wood-3, #8b4513)',
  border: '3px solid var(--wood-3, #8b4513)',
  boxShadow: '0 0 0 3px var(--wood-4, #5d3a1a), inset -1px -1px 0 var(--paper-shadow, #c9a55b)',
  fontSize: 13,
  textDecoration: 'none',
  letterSpacing: '0.1em',
  fontFamily: 'var(--f-pixel, "Courier New", monospace)',
  fontWeight: 700,
};
