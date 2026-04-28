/**
 * G6 · 表情系统 · 8 个古风动作
 *
 * 3 类视觉区分：
 *   - shout  呐喊类（鞠躬/拱手/喝彩/击节）：弹 + 向上飘粒子
 *   - action 动作类（起舞/抚琴）：持续闪烁 5s
 *   - quiet  静默类（沉吟/闭目）：缓慢飘动 4s
 */

export type EmoteCategory = 'shout' | 'action' | 'quiet';

export interface EmoteDef {
  command: string;       // '/yi'
  emoji: string;         // '🙏'
  label: string;         // '拱手'
  description: string;   // '行揖礼，谦恭之礼'
  category: EmoteCategory;
  durationMs: number;    // 多久消失
}

export const EMOTES: EmoteDef[] = [
  {
    command: '/yi',
    emoji: '🙏',
    label: '拱手',
    description: '行揖礼，谦恭之礼',
    category: 'shout',
    durationMs: 3000,
  },
  {
    command: '/bow',
    emoji: '🙇',
    label: '鞠躬',
    description: '深深鞠躬，致以敬意',
    category: 'shout',
    durationMs: 3000,
  },
  {
    command: '/clap',
    emoji: '👏',
    label: '击节',
    description: '击节以赞，叹为观止',
    category: 'shout',
    durationMs: 3000,
  },
  {
    command: '/cheer',
    emoji: '🎉',
    label: '喝彩',
    description: '高声喝彩，声闻四方',
    category: 'shout',
    durationMs: 3000,
  },
  {
    command: '/dance',
    emoji: '💃',
    label: '起舞',
    description: '翩翩起舞，悠然忘忧',
    category: 'action',
    durationMs: 5000,
  },
  {
    command: '/qin',
    emoji: '🎵',
    label: '抚琴',
    description: '抚琴一曲，雅意盎然',
    category: 'action',
    durationMs: 5000,
  },
  {
    command: '/think',
    emoji: '💭',
    label: '沉吟',
    description: '沉吟片刻，似有所悟',
    category: 'quiet',
    durationMs: 4000,
  },
  {
    command: '/sleep',
    emoji: '💤',
    label: '闭目',
    description: '阖目静思，心如止水',
    category: 'quiet',
    durationMs: 4000,
  },
];

export const EMOTE_BY_COMMAND = new Map(EMOTES.map((e) => [e.command, e]));

/** 解析消息文本是否是表情命令；返回匹配的 EmoteDef 或 null */
export function parseEmoteCommand(text: string): EmoteDef | null {
  const trimmed = text.trim().toLowerCase();
  return EMOTE_BY_COMMAND.get(trimmed) ?? null;
}
