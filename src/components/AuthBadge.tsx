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
 * Dead-simple auth badge.
 * Polls window.__supabase every second and renders user info if logged in.
 * No hooks, no subscriptions, no race conditions — just a 1-second poll.
 */
export function AuthBadge() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // Load profile username (may differ from GitHub username if user changed it)
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

    check();  // initial check
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const handleSignOut = async () => {
    const supabase = (window as unknown as { __supabase?: SupabaseClient }).__supabase;
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 460,
        zIndex: 50,
        userSelect: 'none',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      <div
        onClick={() => setMenuOpen((m) => !m)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 6px',
          background: 'rgba(20, 20, 30, 0.85)',
          border: '1px solid rgba(127, 192, 144, 0.4)',
          borderRadius: 999,
          cursor: 'pointer',
          backdropFilter: 'blur(4px)',
        }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '1px solid rgba(127, 192, 144, 0.6)',
            }}
          />
        ) : (
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#7fc090',
              color: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {user.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span style={{ fontSize: 12, color: '#e0d8c0', letterSpacing: '0.05em' }}>
          {user.displayName}
        </span>
        <span style={{ fontSize: 10, color: '#8a8576' }}>▾</span>
      </div>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'transparent' }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              minWidth: 180,
              background: 'rgba(20, 24, 30, 0.98)',
              border: '1px solid rgba(220, 180, 60, 0.3)',
              borderRadius: 6,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              padding: 6,
              zIndex: 51,
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                fontSize: 11,
                color: '#a8b3a0',
                borderBottom: '1px solid rgba(245, 240, 224, 0.06)',
                marginBottom: 4,
              }}
            >
              GitHub: {user.username}
            </div>
            {profileUsername && (
              <Link
                to={`/u/${profileUsername}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  padding: '8px 10px',
                  fontSize: 12,
                  color: '#a5c8ff',
                  cursor: 'pointer',
                  borderRadius: 4,
                  textDecoration: 'none',
                  marginBottom: 2,
                }}
              >
                📋 我的主页 <span style={{ color: '#6e7a8a', fontFamily: 'monospace', fontSize: 10 }}>/u/{profileUsername}</span>
              </Link>
            )}
            <div
              onClick={() => {
                EventBus.emit('open-profile-panel');
                setMenuOpen(false);
              }}
              style={{
                padding: '8px 10px',
                fontSize: 12,
                color: '#e0b060',
                cursor: 'pointer',
                borderRadius: 4,
                marginBottom: 2,
              }}
            >
              ✦ 编辑资料 <span style={{ color: '#8a7c5a', fontSize: 10 }}>(P)</span>
            </div>
            {/* F2.3: cloud sync (upload + pull) */}
            <div style={{
              borderTop: '1px solid rgba(245, 240, 224, 0.06)',
              paddingTop: 4, marginTop: 2, marginBottom: 2,
            }}>
              <CloudSyncButton onClose={() => setMenuOpen(false)} />
            </div>
            <div
              onClick={handleSignOut}
              style={{
                padding: '8px 10px',
                fontSize: 12,
                color: '#c08070',
                cursor: 'pointer',
                borderRadius: 4,
                borderTop: '1px solid rgba(245, 240, 224, 0.06)',
                marginTop: 2, paddingTop: 8,
              }}
            >
              ↩ 登出
            </div>
          </div>
        </>
      )}
    </div>
  );
}
