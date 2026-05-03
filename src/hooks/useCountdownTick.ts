import { useEffect, useState } from 'react';

/**
 * 1 秒间隔 tick · 仅当 enabled=true 时启用
 *
 * 用于驱动撤回倒计时 UI 实时刷新
 */
export function useCountdownTick(enabled: boolean): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  return tick;
}
