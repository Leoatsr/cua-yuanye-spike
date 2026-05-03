import { useEffect, useState, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import {
  followsManager,
  type FollowedUser,
} from '../lib/followsStore';

/**
 * 监听关注 / 粉丝列表
 *
 * 订阅 'follows-updated' EventBus
 */
export function useFollows(): {
  following: FollowedUser[];
  followers: FollowedUser[];
  loading: boolean;
  refresh: () => Promise<void>;
  follow: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  unfollow: (userId: string) => Promise<{ ok: boolean; error?: string }>;
} {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [followers, setFollowers] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [followingList, followersList] = await Promise.all([
        followsManager.listFollowing(),
        followsManager.listFollowers(),
      ]);
      setFollowing(followingList);
      setFollowers(followersList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdated = () => void refresh();
    EventBus.on('follows-updated', onUpdated);
    return () => {
      EventBus.off('follows-updated', onUpdated);
    };
  }, [refresh]);

  return {
    following,
    followers,
    loading,
    refresh,
    follow: (id) => followsManager.follow(id),
    unfollow: (id) => followsManager.unfollow(id),
  };
}
