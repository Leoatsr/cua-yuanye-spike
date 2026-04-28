import { getSupabase } from './supabase';
import { reportError } from './sentry';
import { EventBus } from '../game/EventBus';

/**
 * G5-A · 好友系统客户端 store
 *
 * - 发送 / 接受 / 拒绝 / 取消 / 移除 好友请求
 * - 拉取好友列表 / 待处理请求
 * - 缓存关系状态（避免反复查 RPC）
 */

export type FriendStatus =
  | 'self'           // 自己
  | 'none'           // 无关系
  | 'friends'        // 已成好友
  | 'request_sent'   // 我发起的，对方未处理
  | 'request_received' // 对方发起的，我未处理
  | 'blocked';

export interface Friend {
  friend_id: string;
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
  accepted_at: string | null;
}

export interface IncomingRequest {
  from_user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

export interface OutgoingRequest {
  to_user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

export interface FriendRequests {
  incoming: IncomingRequest[];
  outgoing: OutgoingRequest[];
}

class FriendsManager {
  private statusCache = new Map<string, { status: FriendStatus; at: number }>();
  private cacheTtlMs = 30000; // 30s

  /** 发送好友请求 */
  async sendRequest(
    friendId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'no supabase' };
    try {
      const { data, error } = await supabase.rpc('send_friend_request', {
        p_friend_id: friendId,
      });
      if (error) {
        reportError('send-friend-request', error);
        return { ok: false, error: error.message };
      }
      const result = data as { ok: boolean; error?: string };
      if (result.ok) {
        this.statusCache.delete(friendId);
        EventBus.emit('friends-updated');
      }
      return result;
    } catch (err) {
      reportError('send-friend-request', err);
      return { ok: false, error: String(err) };
    }
  }

  /** 接受好友请求 */
  async accept(
    fromUserId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'no supabase' };
    try {
      const { data, error } = await supabase.rpc('accept_friend_request', {
        p_from_user_id: fromUserId,
      });
      if (error) {
        reportError('accept-friend', error);
        return { ok: false, error: error.message };
      }
      const result = data as { ok: boolean; error?: string };
      if (result.ok) {
        this.statusCache.delete(fromUserId);
        EventBus.emit('friends-updated');
      }
      return result;
    } catch (err) {
      reportError('accept-friend', err);
      return { ok: false, error: String(err) };
    }
  }

  /** 拒绝好友请求 */
  async reject(
    fromUserId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'no supabase' };
    try {
      const { data, error } = await supabase.rpc('reject_friend_request', {
        p_from_user_id: fromUserId,
      });
      if (error) {
        reportError('reject-friend', error);
        return { ok: false, error: error.message };
      }
      this.statusCache.delete(fromUserId);
      EventBus.emit('friends-updated');
      return data as { ok: boolean };
    } catch (err) {
      reportError('reject-friend', err);
      return { ok: false, error: String(err) };
    }
  }

  /** 取消我发出的请求 */
  async cancelRequest(
    friendId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'no supabase' };
    try {
      const { data, error } = await supabase.rpc('cancel_friend_request', {
        p_friend_id: friendId,
      });
      if (error) {
        reportError('cancel-friend', error);
        return { ok: false, error: error.message };
      }
      this.statusCache.delete(friendId);
      EventBus.emit('friends-updated');
      return data as { ok: boolean };
    } catch (err) {
      reportError('cancel-friend', err);
      return { ok: false, error: String(err) };
    }
  }

  /** 移除好友（双向）*/
  async remove(
    friendId: string
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'no supabase' };
    try {
      const { data, error } = await supabase.rpc('remove_friend', {
        p_friend_id: friendId,
      });
      if (error) {
        reportError('remove-friend', error);
        return { ok: false, error: error.message };
      }
      this.statusCache.delete(friendId);
      EventBus.emit('friends-updated');
      return data as { ok: boolean };
    } catch (err) {
      reportError('remove-friend', err);
      return { ok: false, error: String(err) };
    }
  }

  /** 拉好友列表 */
  async listFriends(): Promise<Friend[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('list_my_friends');
      if (error) {
        reportError('list-friends', error);
        return [];
      }
      return (data as Friend[]) ?? [];
    } catch (err) {
      reportError('list-friends', err);
      return [];
    }
  }

  /** 拉待处理请求（incoming + outgoing）*/
  async listRequests(): Promise<FriendRequests> {
    const supabase = getSupabase();
    if (!supabase) return { incoming: [], outgoing: [] };
    try {
      const { data, error } = await supabase.rpc('list_friend_requests');
      if (error) {
        reportError('list-friend-requests', error);
        return { incoming: [], outgoing: [] };
      }
      return data as FriendRequests;
    } catch (err) {
      reportError('list-friend-requests', err);
      return { incoming: [], outgoing: [] };
    }
  }

  /** 查与某人的关系（带缓存）*/
  async getStatus(otherUserId: string): Promise<FriendStatus> {
    if (otherUserId.startsWith('bot-')) return 'none';

    const cached = this.statusCache.get(otherUserId);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.status;
    }

    const supabase = getSupabase();
    if (!supabase) return 'none';
    try {
      const { data, error } = await supabase.rpc('get_friend_status', {
        p_other_user_id: otherUserId,
      });
      if (error) {
        reportError('get-friend-status', error);
        return 'none';
      }
      const status = (data as FriendStatus) ?? 'none';
      this.statusCache.set(otherUserId, { status, at: Date.now() });
      return status;
    } catch (err) {
      reportError('get-friend-status', err);
      return 'none';
    }
  }

  /** 清除缓存（外部调用，比如收到 friend_request 通知后）*/
  invalidateCache(otherUserId?: string) {
    if (otherUserId) {
      this.statusCache.delete(otherUserId);
    } else {
      this.statusCache.clear();
    }
  }
}

export const friendsManager = new FriendsManager();

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { __friends: FriendsManager }).__friends = friendsManager;
}
