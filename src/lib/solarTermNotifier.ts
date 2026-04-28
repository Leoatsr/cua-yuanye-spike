import { computeGameTime, type SolarTerm } from './timeStore';
import { EventBus } from '../game/EventBus';

/**
 * 节气切换检测
 *
 * - 每 30 秒检查一次当前节气
 * - 如果跟上次记录的节气不同，emit 'solar-term-change' 事件
 * - 持久化最后看到的节气，避免重启时误触发
 */

const STORAGE_KEY = 'cua-yuanye-last-solar-term-v1';

let lastSeenTerm: SolarTerm | null = null;
let started = false;

export function startSolarTermNotifier(): void {
  if (started) return;
  if (typeof window === 'undefined') return;
  started = true;

  // 加载最后记录
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) lastSeenTerm = raw as SolarTerm;
  } catch {
    // ignore
  }

  const check = () => {
    const t = computeGameTime();
    if (lastSeenTerm !== t.solarTerm) {
      const oldTerm = lastSeenTerm;
      lastSeenTerm = t.solarTerm;
      try {
        localStorage.setItem(STORAGE_KEY, t.solarTerm);
      } catch {
        // ignore
      }
      // 第一次记录不触发（避免初始化时误弹）
      if (oldTerm !== null) {
        EventBus.emit('solar-term-change', {
          oldTerm,
          newTerm: t.solarTerm,
          season: t.season,
        });
        // 同步更新公告板
        const desc = SOLAR_TERM_DESCRIPTIONS[t.solarTerm];
        void import('./announcementsStore').then((mod) => {
          mod.recordSolarTermNotice(t.solarTerm, desc);
        });
      }
    }
  };

  check();
  window.setInterval(check, 30 * 1000); // 30 秒一查
}

/** 节气描述（用于公告板）*/
export const SOLAR_TERM_DESCRIPTIONS: Record<SolarTerm, string> = {
  立春: '万物初醒 · 春之始',
  雨水: '天降甘霖 · 草木萌动',
  惊蛰: '春雷乍响 · 蛰虫始振',
  春分: '昼夜均分 · 春已半',
  清明: '气清景明 · 万物可见',
  谷雨: '雨生百谷 · 春之末',
  立夏: '万物渐盛 · 夏之始',
  小满: '麦穗渐满 · 阳气充盈',
  芒种: '收割播种 · 农忙之时',
  夏至: '白昼最长 · 阳极之至',
  小暑: '暑气始升 · 万物盛长',
  大暑: '炎热至极 · 三伏天',
  立秋: '凉风至 · 秋之始',
  处暑: '暑气渐退 · 凉意渐浓',
  白露: '草木凝露 · 秋意明显',
  秋分: '昼夜均分 · 秋已半',
  寒露: '露水变寒 · 深秋将至',
  霜降: '初霜降下 · 秋之末',
  立冬: '冬之始 · 万物收藏',
  小雪: '初雪轻落 · 寒气渐重',
  大雪: '雪落渐密 · 万物归静',
  冬至: '白昼最短 · 阴极之至',
  小寒: '寒气未极 · 蕴藏待发',
  大寒: '冬之末 · 最冷之时',
};
