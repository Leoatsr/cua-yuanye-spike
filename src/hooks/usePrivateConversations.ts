import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import {
  chatManager,
  type PrivateConversation,
} from '../lib/chatStore';

/**
 * 拉私聊 conversation 列表 + 监听更新
 *
 * Returns:
 *   conversations: 列表
 *   reload: 手动触发刷新
 */
export function usePrivateConversations(): {
  conversations: PrivateConversation[];
  reload: () => Promise<void>;
} {
  const [conversations, setConversations] = useState<PrivateConversation[]>([]);

  const reload = async () => {
    const list = await chatManager.loadMyConversations();
    setConversations(list);
  };

  useEffect(() => {
    void reload();
    // 订阅所有现有私聊（接收新消息）
    void chatManager.subscribeAllExistingPrivate();

    const onLoaded = (list: PrivateConversation[]) => {
      setConversations(list);
    };
    EventBus.on('chat-conversations-loaded', onLoaded);

    return () => {
      EventBus.off('chat-conversations-loaded', onLoaded);
    };
  }, []);

  return { conversations, reload };
}
