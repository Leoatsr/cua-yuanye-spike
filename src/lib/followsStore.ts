import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * G7-A · 关注系统客户端 store
 *
 * - follow / unfollow
 * - listFollowing / listFollowers
 * - getStats（计数 + 关系状态）
 * - 缓存 stats 30s
 */

export interface FollowedUser {
  followee_id?: string;
  follower_id?: string;
  display_name: string;
  username: string;
  avatar_url: string;
  face: {
    hairstyle?: number;
    hair_color?: number;
    outfit_color?: number;
  };
  level: number;
  level_name: string;
  total_cv: number;
  followed_at: string;
}

export interface FollowStats {
  following_count: number;
  followers_count: number;
  i_follow_them: boolean;
  they_follow_me: boolean;
  is_me: boolean;
}

class FollowsManager {
  private statsCache = new Map<string, { stats: FollowStats; at: number }>();
  private cacheTtlMs = 30000;

  async follow(userId: string): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'no supabase' };
    try {
      const { data, error } = await supabase.rpc('follow_user', {
        p_followee_id: userId,
      });
      if (error) {
        reportError('follow-user', error);
        return { ok: false, error: error.message };
      }
      const result = data as { ok: boolean; error?: string };
      if (result.ok) {
        this.statsCache.delete(userId);
        EventBus.emit('follows-updated', { user_id: userId });
      }
      return result;
    } catch (err) {
      reportError('follow-user', err);
      return { ok: false, error: String(err) };
    }
  }

  async unfollow(userId: string): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'no supabase' };
    try {
      const { data, error } = await supabase.rpc('unfollow_user', {
        p_followee_id: userId,
      });
      if (error) {
        reportError('unfollow-user', error);
        return { ok: false, error: error.message };
      }
      this.statsCache.delete(userId);
      EventBus.emit('follows-updated', { user_id: userId });
      return data as { ok: boolean };
    } catch (err) {
      reportError('unfollow-user', err);
      return { ok: false, error: String(err) };
    }
  }

  async listFollowing(): Promise<FollowedUser[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('list_my_following');
      if (error) {
        reportError('list-following', error);
        return [];
      }
      return (data as FollowedUser[]) ?? [];
    } catch (err) {
      reportError('list-following', err);
      return [];
    }
  }

  async listFollowers(): Promise<FollowedUser[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('list_my_followers');
      if (error) {
        reportError('list-followers', error);
        return [];
      }
      return (data as FollowedUser[]) ?? [];
    } catch (err) {
      reportError('list-followers', err);
      return [];
    }
  }

  async getStats(userId: string): Promise<FollowStats | null> {
    if (userId.startsWith('bot-')) {
      return {
        following_count: 0,
        followers_count: 0,
        i_follow_them: false,
        they_follow_me: false,
        is_me: false,
      };
    }

    const cached = this.statsCache.get(userId);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.stats;
    }

    const supabase = getSupabase();
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_follow_stats', {
        p_user_id: userId,
      });
      if (error) {
        reportError('get-follow-stats', error);
        return null;
      }
      const stats = data as FollowStats;
      this.statsCache.set(userId, { stats, at: Date.now() });
      return stats;
    } catch (err) {
      reportError('get-follow-stats', err);
      return null;
    }
  }

  invalidateCache(userId?: string) {
    if (userId) {
      this.statsCache.delete(userId);
    } else {
      this.statsCache.clear();
    }
  }
}

export const followsManager = new FollowsManager();

if (typeof window !== 'undefined') {
  (window as unknown as { __follows: FollowsManager }).__follows = followsManager;
}
