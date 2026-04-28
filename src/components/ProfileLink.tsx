import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyProfile } from '../lib/profileStore';
import { EventBus } from '../game/EventBus';

/**
 * F4.2 · 右上角"我的主页"链接
 * 显示在 LevelBadge 旁边——点击跳转到自己的 /u/[username] 公开页。
 */
export function ProfileLink() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const profile = await fetchMyProfile();
      if (mounted && profile) setUsername(profile.username);
    })();
    const onUpdate = (p: { username: string } | null) => {
      if (mounted && p) setUsername(p.username);
    };
    EventBus.on('profile-updated', onUpdate);
    EventBus.on('profile-created', onUpdate);
    return () => {
      mounted = false;
      EventBus.off('profile-updated', onUpdate);
      EventBus.off('profile-created', onUpdate);
    };
  }, []);

  if (!username) return null;

  return (
    <Link
      to={`/u/${username}`}
      style={{
        position: 'fixed', top: 16, right: 320, zIndex: 50,
        padding: '6px 12px',
        background: 'rgba(96, 165, 250, 0.12)',
        border: '1px solid rgba(96, 165, 250, 0.4)',
        borderRadius: 4,
        cursor: 'pointer',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
        color: '#a5c8ff',
        backdropFilter: 'blur(4px)',
        fontSize: 12, fontWeight: 500,
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        textDecoration: 'none',
        letterSpacing: '0.05em',
      }}
      title={`/u/${username}`}
    >
      📋 我的主页
    </Link>
  );
}
