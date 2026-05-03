import { useEffect, useState } from 'react';
import { getTotalCV } from '../lib/cv';
import { EventBus } from '../game/EventBus';

/**
 * 监听玩家总 CV（贡献价值）
 *
 * - 初始读 localStorage 的 cv-ledger
 * - 监听 'cv-updated' EventBus 自动刷新
 */
export function useCV(): number {
  const [cv, setCV] = useState<number>(() => getTotalCV());

  useEffect(() => {
    const onUpdate = () => setCV(getTotalCV());
    EventBus.on('cv-updated', onUpdate);
    return () => {
      EventBus.off('cv-updated', onUpdate);
    };
  }, []);

  return cv;
}
