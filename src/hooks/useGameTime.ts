import { useEffect, useState } from 'react';
import { computeGameTime } from '../lib/timeStore';
import type { GameTime } from '../lib/timeStore';

/**
 * 监听游戏时间（每秒更新一次）
 *
 * 返回 { hour, minute, season, solarTerm, phase, ... }
 *
 * 注意：computeGameTime 内部基于 timeSettings.timeMultiplier 计算
 *      用户切倍率后会立刻反映
 */
export function useGameTime(intervalMs = 1000): GameTime {
  const [time, setTime] = useState<GameTime>(() => computeGameTime());

  useEffect(() => {
    const t = setInterval(() => {
      setTime(computeGameTime());
    }, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return time;
}
