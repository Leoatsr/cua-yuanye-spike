/**
 * 真实节气查询 (基于天文日期)
 *
 * Wave 7.K · 修复"右上角节气写死清明"问题。
 * 用法：
 *   import { getRealSolarTerm } from '../lib/realSolarTerm';
 *   const term = getRealSolarTerm(new Date());  // "立夏"
 *
 * 数据源：每年 24 节气日期表（误差 ±1 天）
 * 简化算法：用 5 年平均日期 · 误差极小 · 不依赖天文库。
 */

export type SolarTerm =
  | '立春' | '雨水' | '惊蛰' | '春分' | '清明' | '谷雨'
  | '立夏' | '小满' | '芒种' | '夏至' | '小暑' | '大暑'
  | '立秋' | '处暑' | '白露' | '秋分' | '寒露' | '霜降'
  | '立冬' | '小雪' | '大雪' | '冬至' | '小寒' | '大寒';

/**
 * 24 节气大致日期表 (基于 2020-2030 年的平均值)
 * key: 'MM-DD' 格式 · value: 节气名
 * 节气日期会因年份微调 (±1 天)，但用平均值已经足够准。
 */
const SOLAR_TERMS_TABLE: Array<{ month: number; day: number; term: SolarTerm }> = [
  { month: 1,  day: 5,  term: '小寒' },
  { month: 1,  day: 20, term: '大寒' },
  { month: 2,  day: 4,  term: '立春' },
  { month: 2,  day: 19, term: '雨水' },
  { month: 3,  day: 5,  term: '惊蛰' },
  { month: 3,  day: 20, term: '春分' },
  { month: 4,  day: 5,  term: '清明' },
  { month: 4,  day: 20, term: '谷雨' },
  { month: 5,  day: 5,  term: '立夏' },
  { month: 5,  day: 21, term: '小满' },
  { month: 6,  day: 6,  term: '芒种' },
  { month: 6,  day: 21, term: '夏至' },
  { month: 7,  day: 7,  term: '小暑' },
  { month: 7,  day: 23, term: '大暑' },
  { month: 8,  day: 8,  term: '立秋' },
  { month: 8,  day: 23, term: '处暑' },
  { month: 9,  day: 8,  term: '白露' },
  { month: 9,  day: 23, term: '秋分' },
  { month: 10, day: 8,  term: '寒露' },
  { month: 10, day: 23, term: '霜降' },
  { month: 11, day: 7,  term: '立冬' },
  { month: 11, day: 22, term: '小雪' },
  { month: 12, day: 7,  term: '大雪' },
  { month: 12, day: 22, term: '冬至' },
];

/**
 * 给定日期 · 返回当前所处的节气名 (该节气日期 ≤ today)
 * 例如：2026-05-02 → '立夏' (因为 5/5 还没到 · 但 4/20 谷雨已过)
 *      实际上 5/2 离 5/5 立夏只差 3 天 · 应当显示"立夏前夕"或"谷雨"
 *
 * 这里采用"最近过去的节气"逻辑 (跟实际节气日历一致)。
 */
export function getRealSolarTerm(date: Date = new Date()): SolarTerm {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const today = m * 100 + d;

  // 倒序找：最近一个 ≤ today 的节气
  for (let i = SOLAR_TERMS_TABLE.length - 1; i >= 0; i--) {
    const t = SOLAR_TERMS_TABLE[i];
    const code = t.month * 100 + t.day;
    if (code <= today) return t.term;
  }
  // 如果今年还没到第一个节气 (1/5 之前) · 返回去年最后一个节气：冬至
  return '冬至';
}

/**
 * 给定日期 · 返回距离下一个节气的天数 (用于"距 X 还有 N 天"提示)
 */
export function daysToNextSolarTerm(date: Date = new Date()): { term: SolarTerm; days: number } {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  const today = m * 100 + d;

  for (const t of SOLAR_TERMS_TABLE) {
    const code = t.month * 100 + t.day;
    if (code > today) {
      const next = new Date(y, t.month - 1, t.day);
      const days = Math.ceil((next.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
      return { term: t.term, days };
    }
  }
  // 今年节气都过完 (12/22 后) · 下一个是明年小寒
  const next = new Date(y + 1, 0, 5);
  const days = Math.ceil((next.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  return { term: '小寒', days };
}
