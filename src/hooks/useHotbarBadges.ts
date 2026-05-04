import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { useAnnouncements } from './useAnnouncements';
import { useQuestStates } from './useQuestStates';
import { useMail } from './useMail';
import { useFriends } from './useFriends';
import { useProfile } from './useProfile';
import type { ChatMessage } from '../lib/chatStore';

/**
 * 5 hotbar 图标的红点数据聚合 hook · 微信风
 *
 * 设计原则:
 *   - 公告: 没有真实数 · 用 "·" 字符串占位 (IconBar 改造后特殊处理)
 *   - 任务: count(可接 + 审核结果回来) · status 'available' + 'submitted'
 *   - 邮件: useMail 已有 unreadCount
 *   - 聊天: 自己 listen 'chat-message-received' 维护 (跟 ChatPanel 内部 useUnreadCounts 解耦)
 *           panel 打开后清零 (听 'toggle-panel' / 'open-chat-panel' 事件)
 *   - 好友: requests.incoming.length
 *
 * 返回 5 个数字 · 0 表示不显示红点
 */
export interface HotbarBadges {
  announcement: number;  // 0 或 -1 (-1 = 显示小红点不带数字)
  quest: number;
  mail: number;
  chat: number;
  friends: number;
}

export function useHotbarBadges(): HotbarBadges {
  // 公告: hasUnread → -1 (特殊值 · 给 IconBar 显示无数字小红点)
  const { hasUnread: announcementUnread } = useAnnouncements();

  // 任务: count(available + submitted)
  const questStates = useQuestStates();
  const questCount = Object.values(questStates).reduce((acc, qs) => {
    if (qs.status === 'available' || qs.status === 'submitted') return acc + 1;
    return acc;
  }, 0);

  // 邮件
  const { unreadCount: mailUnread } = useMail();

  // 好友请求
  const friendsApi = useFriends();
  const friendsCount = friendsApi.requests.incoming.length;

  // 聊天: 自己维护 (跟 ChatPanel 解耦)
  const chatCount = useChatHotbarCount();

  return {
    announcement: announcementUnread ? -1 : 0,
    quest: questCount,
    mail: mailUnread,
    chat: chatCount,
    friends: friendsCount,
  };
}

/**
 * Hotbar 专用聊天未读计数
 *
 * 跟 ChatPanel 内部的 useUnreadCounts 完全独立 · 不冲突
 * 规则:
 *   - 收到 chat-message-received → 累加
 *   - panel 打开 (chat) → 清零
 *   - 自己发的不计 (sender_id === myUserId)
 */
function useChatHotbarCount(): number {
  const profile = useProfile();
  const myUserId = profile?.user_id ?? null;
  const [count, setCount] = useState(0);

  useEffect(() => {
    const onMsg = (msg: ChatMessage) => {
      // 自己的消息不计
      if (myUserId && msg.sender_id === myUserId) return;
      setCount((c) => c + 1);
    };
    EventBus.on('chat-message-received', onMsg);
    return () => {
      EventBus.off('chat-message-received', onMsg);
    };
  }, [myUserId]);

  // 监听 chat panel 打开 → 清零
  useEffect(() => {
    const onTogglePanel = (data: { panel?: string }) => {
      if (data?.panel === 'chat') {
        setCount(0);
      }
    };
    const onOpenChat = () => setCount(0);

    EventBus.on('toggle-panel', onTogglePanel);
    EventBus.on('open-chat-panel', onOpenChat);
    return () => {
      EventBus.off('toggle-panel', onTogglePanel);
      EventBus.off('open-chat-panel', onOpenChat);
    };
  }, []);

  return count;
}
