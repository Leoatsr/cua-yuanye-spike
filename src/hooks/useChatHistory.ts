import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import {
  chatManager,
  type ChatMessage,
  type ChatChannelType,
} from '../lib/chatStore';

/**
 * 拉历史消息 + 监听新消息合并
 *
 * world / private 有持久历史
 * scene 没有历史（只实时）
 *
 * Args:
 *   channelType: world / scene / private
 *   channelKey: world | sceneKey | privateChannelKey
 *   recipientId: 用于 private channel 筛选
 */
export function useChatHistory(
  channelType: ChatChannelType,
  channelKey: string | null,
  recipientId?: string,
): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 拉历史
  useEffect(() => {
    setMessages([]);
    if (!channelKey) return;
    if (channelType === 'scene') return;  // scene 无历史

    void chatManager.loadRecentHistory(channelType, channelKey).then((history) => {
      setMessages(history);
    });
  }, [channelType, channelKey]);

  // 监听新消息合并
  useEffect(() => {
    const onMsg = (msg: ChatMessage) => {
      // 频道筛选
      if (msg.channel_type !== channelType) return;
      if (channelType === 'world' && msg.channel_key !== 'world') return;
      if (channelType === 'scene' && msg.channel_key !== channelKey) return;
      if (channelType === 'private') {
        // private: 筛选当前 conversation
        if (!recipientId) return;
        // 跟当前 recipient 通信的 message
        const isInThisConv =
          (msg.sender_id === recipientId) ||
          (msg.recipient_id === recipientId);
        if (!isInThisConv) return;
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-100);
      });
    };

    EventBus.on('chat-message-received', onMsg);
    return () => {
      EventBus.off('chat-message-received', onMsg);
    };
  }, [channelType, channelKey, recipientId]);

  return messages;
}
