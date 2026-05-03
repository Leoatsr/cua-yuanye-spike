import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { ChatMessage, ChatChannelType } from '../lib/chatStore';

interface UnreadCounts {
  world: number;
  scene: number;
  private: number;
}

interface UseUnreadCountsArgs {
  /** 当前激活 tab · 这个 tab 的未读不会累加 */
  activeTab: ChatChannelType;
  /** 私聊当前 recipient · 如果是激活私聊不累加 */
  activeRecipientId: string | null;
  /** 我的 user id · 用于排除自己消息 */
  myUserId: string | null;
  /** Panel 是否打开 · 关闭时所有消息都累加未读 */
  panelOpen: boolean;
}

/**
 * 监听 3 频道未读数
 *
 * 规则：
 *   - 收到 world 消息 + (panel 关闭 OR active tab != world) → world 未读 +1
 *   - 收到 scene 消息 + (panel 关闭 OR active tab != scene) → scene 未读 +1
 *   - 收到 private 消息 + (panel 关闭 OR active tab != private OR recipient 不一致) → private 未读 +1
 *   - 自己发的消息不计入
 */
export function useUnreadCounts(args: UseUnreadCountsArgs): {
  counts: UnreadCounts;
  clearTab: (tab: ChatChannelType) => void;
} {
  const [counts, setCounts] = useState<UnreadCounts>({
    world: 0,
    scene: 0,
    private: 0,
  });

  useEffect(() => {
    const onMsg = (msg: ChatMessage) => {
      // 排除自己消息
      if (args.myUserId && msg.sender_id === args.myUserId) return;

      const channelType = msg.channel_type;
      const isPanelActiveForThis =
        args.panelOpen &&
        args.activeTab === channelType &&
        (channelType !== 'private' ||
          msg.sender_id === args.activeRecipientId);

      if (isPanelActiveForThis) return;

      setCounts((prev) => ({
        ...prev,
        [channelType]: prev[channelType] + 1,
      }));
    };

    EventBus.on('chat-message-received', onMsg);
    return () => {
      EventBus.off('chat-message-received', onMsg);
    };
  }, [args.myUserId, args.panelOpen, args.activeTab, args.activeRecipientId]);

  // tab 切换时清零
  useEffect(() => {
    if (!args.panelOpen) return;
    setCounts((prev) => ({ ...prev, [args.activeTab]: 0 }));
  }, [args.activeTab, args.panelOpen]);

  // private recipient 切换时清零
  useEffect(() => {
    if (!args.panelOpen) return;
    if (args.activeTab !== 'private') return;
    if (!args.activeRecipientId) return;
    setCounts((prev) => ({ ...prev, private: 0 }));
  }, [args.activeRecipientId, args.activeTab, args.panelOpen]);

  const clearTab = (tab: ChatChannelType) => {
    setCounts((prev) => ({ ...prev, [tab]: 0 }));
  };

  return { counts, clearTab };
}
