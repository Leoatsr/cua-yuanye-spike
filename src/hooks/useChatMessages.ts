import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import type { ChatMessage } from '../lib/chatStore';

/**
 * 监听 chat 消息（按频道筛选）
 *
 * Wave 2.3.A 只用 'world'
 * Wave 2.3.B 会加 'scene' / 'private'
 */
export function useChatMessages(channelType: 'world' | 'scene' | 'private' = 'world'): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const onMsg = (msg: ChatMessage) => {
      if (msg.channel_type !== channelType) return;
      setMessages((prev) => {
        // 去重 — 同 id 的不重复加
        if (prev.some((m) => m.id === msg.id)) return prev;
        // 最近 100 条
        return [...prev, msg].slice(-100);
      });
    };

    EventBus.on('chat-message-received', onMsg);
    return () => {
      EventBus.off('chat-message-received', onMsg);
    };
  }, [channelType]);

  return messages;
}
