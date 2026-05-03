import { useEffect, useState, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import {
  friendsManager,
  type Friend,
  type FriendRequests,
} from '../lib/friendsStore';

/**
 * 监听好友列表 + 请求
 *
 * 订阅 'friends-updated' EventBus
 * 提供 send / accept / reject / cancel / remove 包装
 */
export function useFriends(): {
  friends: Friend[];
  requests: FriendRequests;
  loading: boolean;
  refresh: () => Promise<void>;
  sendRequest: (friendId: string) => Promise<{ ok: boolean; error?: string }>;
  accept: (fromUserId: string) => Promise<{ ok: boolean; error?: string }>;
  reject: (fromUserId: string) => Promise<{ ok: boolean; error?: string }>;
  cancelRequest: (toUserId: string) => Promise<{ ok: boolean; error?: string }>;
  remove: (friendId: string) => Promise<{ ok: boolean; error?: string }>;
} {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({
    incoming: [],
    outgoing: [],
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, reqs] = await Promise.all([
        friendsManager.listFriends(),
        friendsManager.listRequests(),
      ]);
      setFriends(list);
      setRequests(reqs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdated = () => void refresh();
    EventBus.on('friends-updated', onUpdated);
    return () => {
      EventBus.off('friends-updated', onUpdated);
    };
  }, [refresh]);

  return {
    friends,
    requests,
    loading,
    refresh,
    sendRequest: (id) => friendsManager.sendRequest(id),
    accept: (id) => friendsManager.accept(id),
    reject: (id) => friendsManager.reject(id),
    cancelRequest: (id) => friendsManager.cancelRequest(id),
    remove: (id) => friendsManager.remove(id),
  };
}
