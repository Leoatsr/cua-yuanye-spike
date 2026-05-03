import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';

interface OnlineCount {
  global: number;
  scene: number;
}

/**
 * 监听在线人数（全局 + 当前场景）
 *
 * 由 presence.ts emit 'online-count-updated' 事件驱动
 * 初始值 (1, 1) 表示"我自己在线"，等 presence 同步后会更新
 */
export function useOnlineCount(): OnlineCount {
  const [count, setCount] = useState<OnlineCount>({ global: 1, scene: 1 });

  useEffect(() => {
    const onUpdate = (data: OnlineCount) => setCount(data);
    EventBus.on('online-count-updated', onUpdate);
    return () => {
      EventBus.off('online-count-updated', onUpdate);
    };
  }, []);

  return count;
}
