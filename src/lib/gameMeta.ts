/**
 * CUA 基地 · 游戏元数据
 * 区域 / 工坊 / NPC / 等级 — Landing 页和图鉴页共用
 */

import type { ChipTone } from '../ui/Chip';
import type { BannerTone } from '../ui/Banner';

export type RegionTone = Extract<ChipTone, 'spring' | 'gold' | 'jade'>;

export interface Region {
  id: string;
  name: string;
  level: string;
  tone: RegionTone;
  summary: string;
  tile: string;
}

export interface Workshop {
  name: string;
  group: '降噪' | '链接' | '共创';
  icon: string;
  desc: string;
  color: string;
}

export interface NPC {
  name: string;
  role: string;
  region: string;
  line: string;
  tone: RegionTone;
}

export interface Level {
  lv: string;
  name: string;
  area: string;
  cv: string;
}

export const REGIONS: Region[] = [
  {
    id: 'sproutown',
    name: '萌芽镇',
    level: 'L0 · 新人起点',
    tone: 'spring',
    summary: '新手村。跟村长阿降学基础玩法，完成 5 个新手任务，建立你的初始 CV。',
    tile: '🌱',
  },
  {
    id: 'contributors',
    name: '贡献者中心',
    level: 'L1+ · 共创之都',
    tone: 'gold',
    summary:
      '9 个工作组组成的协作网络。降噪 / 链接 / 共创 三大板块，每个工坊对应一类真实社区贡献。',
    tile: '🏛',
  },
  {
    id: 'governance',
    name: '议政高地',
    level: 'L2+ · 治理空间',
    tone: 'jade',
    summary: '贡献者大会、监察委员会。攒够 CV 后参与提案、投票、申诉裁定。',
    tile: '⚖',
  },
];

export const WORKSHOPS: Workshop[] = [
  { name: '播客工坊', group: '降噪', icon: '📻', desc: '对谈、采访、圆桌输出行业洞察', color: '#c97b4a' },
  { name: '百科工坊', group: '降噪', icon: '📖', desc: '构建 CUA 行业百科知识沉淀', color: '#a0522d' },
  { name: '数据工坊', group: '降噪', icon: '📊', desc: '人才/论文/项目数据收集清洗', color: '#8b4513' },
  { name: '内参工坊', group: '降噪', icon: '📜', desc: '深度行业调研与趋势分析', color: '#5d3a1a' },
  { name: '招聘工坊', group: '链接', icon: '🤝', desc: '对接行业人才与社区贡献者', color: '#2f6b5d' },
  { name: '会议工坊', group: '链接', icon: '🎙', desc: '策划线上线下技术交流', color: '#3d6c5e' },
  { name: '开源工坊', group: '共创', icon: '⚙', desc: '热爱代码、架构与学术研究', color: '#daa520' },
  { name: '测评工坊', group: '共创', icon: '🔬', desc: 'CUA 技术与产品测试评估', color: '#a07515' },
  { name: '生态工坊', group: '共创', icon: '🌐', desc: '系统软件生态开放度追踪', color: '#7a5c10' },
];

export const NPCS: NPC[] = [
  { name: '村长阿降', role: '新手引路人', region: '萌芽镇', line: '初来乍到？先把这五件小事做了，CV 自然来。', tone: 'spring' },
  { name: '周明', role: 'AI 审核员', region: '贡献者中心', line: '审稿如读经，慢即是快。', tone: 'gold' },
  { name: '严之', role: 'AI 审核员', region: '贡献者中心', line: '差一字也不行。', tone: 'gold' },
  { name: '白徽', role: 'AI 审核员', region: '贡献者中心', line: '好作品自己会说话。', tone: 'gold' },
  { name: '阿香', role: '杂货商', region: '萌芽镇', line: '新到的笔墨纸砚，要不要看看？', tone: 'spring' },
  { name: '议长', role: '提案管事', region: '议政高地', line: '持 CV 满千者，可上议政台。', tone: 'jade' },
];

export const LEVELS: Level[] = [
  { lv: 'L0', name: '新人', area: '萌芽镇', cv: '0–99' },
  { lv: 'L1', name: '活跃贡献者', area: '解锁贡献者中心', cv: '100–499' },
  { lv: 'L2', name: '核心贡献者', area: '解锁议政参与', cv: '500–1499' },
  { lv: 'L3', name: '子项目负责人', area: '可发起提案', cv: '1500–4999' },
  { lv: 'L4', name: '主席', area: '参与申诉裁定', cv: '5000+' },
];

// helper: BannerTone <-> ChipTone 转换
export function regionToBannerTone(t: RegionTone): BannerTone {
  return t;
}
