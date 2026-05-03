import { useCV } from './useCV';
import { LEVELS } from '../lib/gameMeta';
import type { Level } from '../lib/gameMeta';

/**
 * 根据当前 CV 算出等级
 *
 * 等级阈值（来自 gameMeta.LEVELS）:
 *   L0 新人        0-99
 *   L1 活跃贡献者   100-499
 *   L2 核心贡献者   500-1499
 *   L3 子项目负责人 1500-4999
 *   L4 主席        5000+
 *
 * 返回 { level, levelLabel, nextThreshold, nextLevelLabel }
 */

const LEVEL_THRESHOLDS = [0, 100, 500, 1500, 5000];  // L0/L1/L2/L3/L4

export interface LevelInfo {
  level: Level;            // 当前等级 row
  levelIndex: number;      // 0-4
  currentThreshold: number;
  nextThreshold: number;   // 下一等级所需 CV，已 L4 则 = currentThreshold
  nextLevelLabel: string;  // "L2" / "L4 (满级)"
  isMax: boolean;
}

export function useLevel(): LevelInfo {
  const cv = useCV();

  let levelIndex = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (cv >= LEVEL_THRESHOLDS[i]) {
      levelIndex = i;
      break;
    }
  }

  const isMax = levelIndex >= LEVEL_THRESHOLDS.length - 1;
  const currentThreshold = LEVEL_THRESHOLDS[levelIndex];
  const nextThreshold = isMax
    ? currentThreshold
    : LEVEL_THRESHOLDS[levelIndex + 1];

  const level = LEVELS[levelIndex];
  const nextLevelLabel = isMax
    ? `${level.lv} (满级)`
    : LEVELS[levelIndex + 1].lv;

  return {
    level,
    levelIndex,
    currentThreshold,
    nextThreshold,
    nextLevelLabel,
    isMax,
  };
}
