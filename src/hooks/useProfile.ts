import { useEffect, useState } from 'react';
import { fetchMyProfile } from '../lib/profileStore';
import type { UserProfile } from '../lib/profileStore';
import { EventBus } from '../game/EventBus';

/**
 * 监听玩家 profile（含 display_name / username / avatar_url）
 *
 * - 首次 mount 时调用 fetchMyProfile
 * - 后续监听 'profile-updated' / 'profile-created' 事件自动刷新
 */
export function useProfile(): UserProfile | null {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMyProfile().then((p) => {
      if (!cancelled) setProfile(p);
    });

    const onUpdate = (next: UserProfile) => setProfile(next);

    EventBus.on('profile-updated', onUpdate);
    EventBus.on('profile-created', onUpdate);

    return () => {
      cancelled = true;
      EventBus.off('profile-updated', onUpdate);
      EventBus.off('profile-created', onUpdate);
    };
  }, []);

  return profile;
}
