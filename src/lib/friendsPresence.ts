import { EventBus } from '../game/EventBus';
import { presence } from './realtimePresence';
import { friendsManager, type Friend } from './friendsStore';

/**
 * G5-B · 好友在线状态
 *
 * - 启动时拉好友列表
 * - 监听 'global-presence-updated' 事件（来自 realtimePresence）
 * - 计算哪些好友在线，emit 'friends-presence-updated'
 * - 也监听 'friends-updated'（好友列表变了重新拉）
 *
 * 不需要新的 Realtime 连接，复用 G1 的 global-online channel。
 */

class FriendsPresence {
  private friendIds = new Set<string>();
  private friendInfo = new Map<string, Friend>();
  private onlineFriendIds = new Set<string>();
  private started = false;

  /** 启动监听（App 启动时调一次）*/
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // 拉初始好友列表
    await this.refreshFriends();

    // 监听好友列表变化
    EventBus.on('friends-updated', () => {
      void this.refreshFriends();
    });

    // 监听全局在线变化
    EventBus.on('global-presence-updated', (data: { user_ids: string[] }) => {
      this.recalcOnline(data.user_ids);
    });

    // 启动后立刻算一次（刚加载时 global-presence-updated 可能还没发）
    setTimeout(() => {
      this.recalcOnline(presence.getGlobalUserIds());
    }, 1000);
  }

  /** 刷新好友列表 */
  async refreshFriends(): Promise<void> {
    const list = await friendsManager.listFriends();
    this.friendIds = new Set(list.map((f) => f.friend_id));
    this.friendInfo = new Map(list.map((f) => [f.friend_id, f]));
    // 重新算一遍
    this.recalcOnline(presence.getGlobalUserIds());
  }

  private recalcOnline(globalUserIds: string[]) {
    const next = new Set<string>();
    for (const id of globalUserIds) {
      if (this.friendIds.has(id)) {
        next.add(id);
      }
    }
    // 检查是否有变化
    let changed = next.size !== this.onlineFriendIds.size;
    if (!changed) {
      for (const id of next) {
        if (!this.onlineFriendIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      this.onlineFriendIds = next;
      EventBus.emit('friends-presence-updated', {
        online_count: next.size,
        online_ids: Array.from(next),
      });
    }
  }

  isOnline(userId: string): boolean {
    return this.onlineFriendIds.has(userId);
  }

  getOnlineCount(): number {
    return this.onlineFriendIds.size;
  }

  getOnlineFriends(): Friend[] {
    return Array.from(this.onlineFriendIds)
      .map((id) => this.friendInfo.get(id))
      .filter((f): f is Friend => Boolean(f));
  }

  getAllFriends(): Friend[] {
    return Array.from(this.friendInfo.values());
  }

  getFriendIds(): Set<string> {
    return this.friendIds;
  }
}

export const friendsPresence = new FriendsPresence();

if (typeof window !== 'undefined') {
  (window as unknown as { __friendsPresence: FriendsPresence }).__friendsPresence =
    friendsPresence;
}
