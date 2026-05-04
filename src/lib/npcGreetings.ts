import type { DayPhase } from './timeStore';

/**
 * NPC 问候语 — 不改 NPC 类，监听 show-dialogue 事件后弹问候 toast
 *
 * 策略：在 NPC 对话弹起时，**额外**显示一个时段问候 toast
 * （不替换原对话）—— 这样玩家既看到原台词又感受到时段变化
 */

export const NPC_GREETINGS_BY_PHASE: Record<DayPhase, string[]> = {
  dawn: [
    '清晨的雾还没散，你来得真早',
    '早安——林间的鸟刚醒',
    '一日之计在于晨',
    '茶水才煮好，你来得正巧',
  ],
  day: [
    '日头正盛，办事的好时候',
    '辛苦了，来歇会儿',
    '今天阳光不错',
    '近来怎么样？',
  ],
  dusk: [
    '夕阳真美——你瞧那霞光',
    '快到掌灯时分了',
    '一日将尽，难得清闲',
    '黄昏好',
  ],
  night: [
    '夜深了，还在外面走？',
    '夜里清静，正适合谈心',
    '掌灯了——你也保重身子',
    '夜来风急，留意添衣',
  ],
};

/**
 * 萌芽镇 NPC 名字（含 5 个 bot + 高粱）
 *
 * 跟 G1 fakeBots 里的名字对齐 —— 用于 show-dialogue 事件 speaker 字段匹配
 */
export const SPROUT_TOWN_NPCS = [
  '老村长 · 高粱',
  '高粱',
  '春雨',
  '茶童',
  '文谦',
  '竹雯',
  '陶清',
  // 兼容含 emoji 的版本
  '🌸 春雨',
  '🍵 茶童',
  '📜 文谦',
  '🎋 竹雯',
  '⚱️ 陶清',
];

/**
 * 判断一个 speaker 名字是否属于萌芽镇 NPC（这一波只覆盖萌芽镇）
 */
export function isSproutTownNpc(speaker: string | undefined | null): boolean {
  if (!speaker) return false;
  const normalized = speaker.trim();
  return SPROUT_TOWN_NPCS.some(
    (n) => n === normalized || normalized.includes(n.replace(/[🌸🍵📜🎋⚱️]/g, '').trim())
  );
}

/**
 * 随机挑一句问候 — 同一时段同一玩家保持稳定，避免不停换
 */
export function pickGreeting(phase: DayPhase, seed: number): string {
  const arr = NPC_GREETINGS_BY_PHASE[phase];
  const idx = Math.abs(seed) % arr.length;
  return arr[idx];
}
