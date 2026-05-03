import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMyProfile } from '../lib/profileStore';
import { EventBus } from '../game/EventBus';
import { CloudSyncButton } from './CloudSyncButton';

interface UserInfo {
  username: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * Wave 7.E · 像素风账户菜单
 *
 * 顶替原 AuthBadge 黑色 pill + ProfileLink 按钮。
 * 视觉上不渲染任何按钮 —— 由 NewGameAppHUD 的 AvatarPanel onClick 触发。
 * 通过 EventBus 'toggle-account-menu' 打开/关闭。
 *
 * 数据源:
 *   - window.__supabase poll (跟原 AuthBadge 一模一样)
 *   - profileStore (跟原 AuthBadge 一模一样)
 *
 * 功能:
 *   - GitHub username 显示
 *   - 我的主页 (/u/{username})
 *   - 编辑资料 (emit 'open-profile-panel')
 *   - 云端同步 (CloudSyncButton)
 *   - 登出 (supabase.auth.signOut)
 */
export function PixelAccountMenu() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // 跟原 AuthBadge 一样：fetch profile.username
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const profile = await fetchMyProfile();
      if (mounted && profile) setProfileUsername(profile.username);
    })();
    const onUpdate = (p: { username: string } | null) => {
      if (mounted && p) setProfileUsername(p.username);
    };
    EventBus.on('profile-updated', onUpdate);
    EventBus.on('profile-created', onUpdate);
    return () => {
      mounted = false;
      EventBus.off('profile-updated', onUpdate);
      EventBus.off('profile-created', onUpdate);
    };
  }, []);

  // 跟原 AuthBadge 一样：1s poll supabase user
  useEffect(() => {
    const check = async () => {
      const supabase = (window as unknown as { __supabase?: SupabaseClient }).__supabase;
      if (!supabase) {
        setUser(null);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user;
        if (!u) {
          setUser(null);
          return;
        }
        const meta = u.user_metadata ?? {};
        setUser({
          username: (meta.user_name ?? meta.preferred_username ?? '') as string,
          displayName: (meta.full_name ?? meta.name ?? meta.user_name ?? u.email ?? 'Unknown') as string,
          avatarUrl: (meta.avatar_url ?? '') as string,
        });
      } catch {
        setUser(null);
      }
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  // 监听头像 click 事件
  useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    EventBus.on('toggle-account-menu', onToggle);
    return () => { EventBus.off('toggle-account-menu', onToggle); };
  }, []);

  if (!user || !open) return null;

  const handleSignOut = async () => {
    const supabase = (window as unknown as { __supabase?: SupabaseClient }).__supabase;
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setOpen(false);
  };

  return (
    <>
      {/* Click outside to close */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 199,
          background: 'transparent',
        }}
      />

      {/* Pixel dropdown menu */}
      <div
        style={{
          position: 'fixed',
          // AvatarPanel 在 top:12 left:12 · panel 宽~ 180-200 · menu drop 在头像下方
          top: 70,
          left: 12,
          width: 240,
          background: 'var(--paper-1, #fdf0cf)',
          border: '4px solid var(--wood-3, #8b4513)',
          boxShadow:
            '0 0 0 4px var(--wood-4, #5d3a1a), inset 0 0 0 3px var(--paper-3, #e8c98a), 6px 6px 0 0 rgba(60, 30, 10, 0.25)',
          fontFamily: 'var(--f-pixel, "Courier New", monospace)',
          color: 'var(--ink, #3a2a1a)',
          padding: 0,
          zIndex: 200,
          userSelect: 'none',
        }}
      >
        {/* GitHub username */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '2px solid var(--paper-shadow, #c9a55b)',
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: 'var(--wood-2, #a0522d)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            GitHub
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--ink, #3a2a1a)',
              fontFamily: 'var(--f-title, "Songti SC", "Noto Serif SC", serif)',
              fontWeight: 500,
            }}
          >
            {user.username}
          </div>
        </div>

        {/* 我的主页 */}
        {profileUsername && (
          <Link
            to={`/u/${profileUsername}`}
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--paper-shadow, #c9a55b)',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--ink, #3a2a1a)',
              textDecoration: 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                'var(--paper-0, #fff8dc)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📋</span>
            <span style={{ flex: 1 }}>我的主页</span>
            <span
              style={{
                fontSize: 9,
                color: 'var(--ink-faint, #9c7c54)',
              }}
            >
              /u/{profileUsername}
            </span>
          </Link>
        )}

        {/* 编辑资料 */}
        <div
          onClick={() => {
            EventBus.emit('open-profile-panel');
            setOpen(false);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderBottom: '1px solid var(--paper-shadow, #c9a55b)',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--gold, #daa520)',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background =
              'var(--paper-0, #fff8dc)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>✦</span>
          <span style={{ flex: 1 }}>编辑资料</span>
          <span
            style={{
              fontSize: 9,
              color: 'var(--ink-faint, #9c7c54)',
            }}
          >
            (P)
          </span>
        </div>

        {/* 云端同步 */}
        <div
          style={{
            padding: '6px 8px',
            borderBottom: '1px solid var(--paper-shadow, #c9a55b)',
          }}
        >
          <CloudSyncButton onClose={() => setOpen(false)} />
        </div>

        {/* 登出 */}
        <div
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--danger, #a32d2d)',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background =
              'var(--paper-0, #fff8dc)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>↩</span>
          <span>登出</span>
        </div>
      </div>
    </>
  );
}
