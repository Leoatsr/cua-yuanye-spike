/**
 * 路线图数据 · 5 stages
 *
 * 抽自 RoadmapPanel.tsx 内部 STAGES 数组（Wave 2.5.C）
 * 跟旧 RoadmapPanel 数据 100% 一致
 */

export interface RoadmapStage {
  id: string;
  phaseLabel: string;
  name: string;
  description: string;
  status: 'done' | 'progress' | 'todo';
  progress: number; // 0-100
  highlights: string[];
}

export const STAGES: RoadmapStage[] = [
  {
    id: 'sproutown',
    phaseLabel: 'Phase 1',
    name: '萌芽镇',
    description: '像素体验 + 治理叙事的起点。',
    status: 'done',
    progress: 100,
    highlights: [
      '9 大角色变量',
      '阿降 NPC + 引导教程',
      '典籍阁 / 铁匠铺 / 阿降小屋',
      '萌芽印记成长系统',
    ],
  },
  {
    id: 'cocity',
    phaseLabel: 'Phase 2',
    name: '共创之都',
    description: '9 大工坊环绕中央喷泉广场。',
    status: 'progress',
    progress: 33,
    highlights: [
      '✓ 9 工坊外景与喷泉广场',
      '✓ 百晓居首工坊开放（5 真任务）',
      '✓ 任务提交 / 撤回 / 审核 / 申诉闭环',
      '✓ CV 入账 + 邮件系统',
      '⏳ 其余 8 工坊筹建中',
    ],
  },
  {
    id: 'govhill',
    phaseLabel: 'Phase 4',
    name: '议政高地',
    description: '远见塔、执政厅、明镜阁——治理中心。',
    status: 'progress',
    progress: 25,
    highlights: [
      '✓ 三大陆地图层（C6.0）',
      '✓ 远见塔路线图（你正在看的就是）',
      '✓ 明镜阁申诉案桌（C6.2）',
      '⏳ 执政厅 · 提案投票系统（C6.3）',
      '⏳ L5 权限校验（待 F5）',
    ],
  },
  {
    id: 'realtask',
    phaseLabel: 'Phase 2.5',
    name: '真任务源',
    description: '从虚构任务，迁向真实贡献。',
    status: 'todo',
    progress: 0,
    highlights: [
      '⏭ GitHub Issues 双向同步',
      '⏭ 玩家提交回写 PR/Comment',
      '⏭ Issue Template 标准化',
      '⏭ contributor.md 自动 PR',
    ],
  },
  {
    id: 'multiplayer',
    phaseLabel: 'Phase 3',
    name: '多人在场',
    description: '同屏 10+ 玩家、实时协作。',
    status: 'todo',
    progress: 0,
    highlights: [
      '⏭ Supabase Realtime 在线状态',
      '⏭ 玩家位置同步',
      '⏭ 实时聊天（世界 / 工坊 / 私聊）',
      '⏭ 真审核员入驻',
    ],
  },
];

export const STATUS_LABELS: Record<RoadmapStage['status'], string> = {
  done: '已完成',
  progress: '进行中',
  todo: '待开始',
};

export const STATUS_TONES: Record<
  RoadmapStage['status'],
  'spring' | 'gold' | ''
> = {
  done: 'spring',
  progress: 'gold',
  todo: '',
};
