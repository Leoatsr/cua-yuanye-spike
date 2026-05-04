import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { presence } from '../lib/realtimePresence';

interface GlobalPresencePayload {
  user_ids: string[];
}

/**
 * 全局在线状态 hook
 *
 * 订阅 realtimePresence emit 的 'global-presence-updated' 事件
 * 暴露当前所有跨场景在线的 user_id 集合
 *
 * 用法:
 *   const online = useGlobalPresence();
 *   online.has(userId); // boolean
 *
 * 数据流:
 *   realtimePresence.ts (G5-B) → EventBus 'global-presence-updated' → 此 hook
 */
export function useGlobalPresence(): Set<string> {
  const [onlineSet, setOnlineSet] = useState<Set<string>>(() => {
    // 初始值: 直接从 presence 拿当前快照 (避免首次渲染前空白)
    return new Set(presence.getGlobalUserIds());
  });

  useEffect(() => {
    const onUpdate = (data: GlobalPresencePayload) => {
      setOnlineSet(new Set(data.user_ids));
    };
    EventBus.on('global-presence-updated', onUpdate);
    return () => {
      EventBus.off('global-presence-updated', onUpdate);
    };
  }, []);

  return onlineSet;
}
