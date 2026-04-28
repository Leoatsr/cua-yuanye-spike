/**
 * 季节 + 昼夜系统时间引擎
 *
 * 时间映射:
 *   - 1 游戏日 = 48 现实分钟
 *   - 1 游戏季 = 7 游戏日 = 5.6 现实小时
 *   - 1 游戏年 = 4 季 = 22.4 小时
 *
 * 昼夜阶段（每 12 游戏分钟切换一段）:
 *   - 06:00-08:00  ☀️ 早晨 (dawn)
 *   - 08:00-17:00  🌞 白天 (day)
 *   - 17:00-19:00  🌅 黄昏 (dusk)
 *   - 19:00-06:00  🌙 夜晚 (night)
 *
 * 季节循环: 春 → 夏 → 秋 → 冬 → 春
 * 节气: 24 节气，每节气 ~7 游戏小时
 *
 * 锚点: epoch = 2026-01-01 00:00:00 UTC = 游戏内 春 · 立春 · 第 1 日 · 00:00
 * 之后所有时间从 Date.now() 反算
 */

// 默认 48 分钟 = 1 游戏日；可被 timeSettings.timeMultiplier 调整
const DEFAULT_REAL_MS_PER_GAME_DAY = 48 * 60 * 1000;
const GAME_DAYS_PER_SEASON = 7;
const SEASONS = ['春', '夏', '秋', '冬'] as const;
export type Season = (typeof SEASONS)[number];

// 24 节气（按游戏年内的"第 N 日"切分）
const SOLAR_TERMS = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',  // 春 6 个
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',  // 夏 6 个
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',  // 秋 6 个
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',  // 冬 6 个
] as const;
export type SolarTerm = (typeof SOLAR_TERMS)[number];

// 锚点：2026-01-01 00:00 UTC = 春 · 立春 · 第 1 日 · 00:00
const EPOCH_MS = new Date('2026-01-01T00:00:00Z').getTime();

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface GameTime {
  // 当前游戏时间
  totalGameDays: number;     // 距离 epoch 的游戏天数
  hour: number;              // 0-23
  minute: number;            // 0-59
  // 季节
  seasonIndex: number;       // 0-3
  season: Season;
  dayInSeason: number;       // 1-7
  // 节气
  termIndex: number;         // 0-23
  solarTerm: SolarTerm;
  // 昼夜
  phase: DayPhase;
  // 用于 overlay 的连续值（0-1, 0 = 半夜, 0.25 = 早, 0.5 = 中午, 0.75 = 黄昏）
  dayProgress: number;
}

/** 计算当前游戏时间 */
export function computeGameTime(now: number = Date.now()): GameTime {
  const elapsedMs = Math.max(0, now - EPOCH_MS);
  const multiplier = timeSettings.get().timeMultiplier;
  const msPerDay = DEFAULT_REAL_MS_PER_GAME_DAY / multiplier;

  const totalGameDays = elapsedMs / msPerDay;
  const dayFraction = totalGameDays - Math.floor(totalGameDays);
  const totalGameHours = dayFraction * 24;
  const hour = Math.floor(totalGameHours);
  const minute = Math.floor((totalGameHours - hour) * 60);

  // 季节：每 7 游戏日轮换
  const seasonDayCount = Math.floor(totalGameDays);
  const yearProgress = (seasonDayCount % (GAME_DAYS_PER_SEASON * 4));
  const seasonIndex = Math.floor(yearProgress / GAME_DAYS_PER_SEASON);
  const season = SEASONS[seasonIndex];
  const dayInSeason = (yearProgress % GAME_DAYS_PER_SEASON) + 1;

  // 节气：1 季 = 6 节气（每节气约 1.17 游戏日 = 56 现实分钟）
  // 7 游戏日 / 6 节气 = 1.1666... 日/节气
  const termInSeason = Math.floor((yearProgress % GAME_DAYS_PER_SEASON) / (GAME_DAYS_PER_SEASON / 6));
  const termIndex = Math.min(seasonIndex * 6 + termInSeason, 23);
  const solarTerm = SOLAR_TERMS[termIndex];

  // 昼夜阶段
  let phase: DayPhase;
  if (hour >= 6 && hour < 8) phase = 'dawn';
  else if (hour >= 8 && hour < 17) phase = 'day';
  else if (hour >= 17 && hour < 19) phase = 'dusk';
  else phase = 'night';

  return {
    totalGameDays,
    hour,
    minute,
    seasonIndex,
    season,
    dayInSeason,
    termIndex,
    solarTerm,
    phase,
    dayProgress: dayFraction,
  };
}

/** 格式化时间 HH:MM */
export function formatTime(t: GameTime): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

/** 季节 emoji */
export function seasonEmoji(season: Season): string {
  return season === '春' ? '🌸' : season === '夏' ? '☀️' : season === '秋' ? '🍂' : '❄️';
}

/** 昼夜阶段 emoji */
export function phaseEmoji(phase: DayPhase): string {
  return phase === 'dawn' ? '🌅' : phase === 'day' ? '☀️' : phase === 'dusk' ? '🌇' : '🌙';
}

/** 昼夜阶段中文 */
export function phaseLabel(phase: DayPhase): string {
  return phase === 'dawn' ? '清晨' : phase === 'day' ? '白昼' : phase === 'dusk' ? '黄昏' : '夜晚';
}


// ============================================================================
// 设置（持久化）
// ============================================================================

interface TimeSettings {
  enabled: boolean;        // 是否开启季节/昼夜系统
  showOverlay: boolean;    // 是否显示昼夜/季节色调
  showHUD: boolean;        // 是否显示 HUD 时间显示
  timeMultiplier: number;  // 时间倍率 1 / 4 / 24
  overlayIntensity: number; // 0-1 色调强度倍数
}

const SETTINGS_KEY = 'cua-yuanye-time-settings-v1';

const DEFAULT_SETTINGS: TimeSettings = {
  enabled: true,
  showOverlay: true,
  showHUD: true,
  timeMultiplier: 1,
  overlayIntensity: 1,
};

class TimeSettingsManager {
  private settings: TimeSettings = DEFAULT_SETTINGS;
  private listeners = new Set<() => void>();

  load(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TimeSettings;
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  get(): TimeSettings {
    return this.settings;
  }

  update(patch: Partial<TimeSettings>): void {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    for (const l of this.listeners) l();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const timeSettings = new TimeSettingsManager();

if (typeof window !== 'undefined') {
  (window as unknown as { __time: () => GameTime }).__time = computeGameTime;
}
