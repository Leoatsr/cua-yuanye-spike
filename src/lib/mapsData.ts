/**
 * 世界地图数据 · 4 location
 *
 * Wave 4.A
 * 重写自 components/WorldMap.tsx 内置数据
 */

export interface MapLocation {
  id: 'sproutown' | 'sproutcity' | 'zhengzheng' | 'dasaiji';
  name: string;
  /** 简短地区类型 */
  region: string;
  /** 一句话描述（地图卡片用） */
  description: string;
  /** 详细介绍（详情面板用） */
  longDesc: string;
  /** 主要 NPC / 设施 */
  highlights: string[];
  /** Position on the world map UI (percentage of container) */
  xPct: number;
  yPct: number;
  /** Whether this location is reachable */
  available: boolean;
  /** The Phaser scene key to switch to (if available) */
  sceneKey: 'Main' | 'SproutCity' | 'GovHill' | 'GrandPlaza';
  /** 像素图标 */
  icon: string;
  /** 配色 */
  tone: 'spring' | 'gold' | 'jade' | '';
  /** 等级 */
  level: string;
}

export const LOCATIONS: MapLocation[] = [
  {
    id: 'sproutown',
    name: '萌芽镇',
    region: 'L0 · 新人起点',
    description: '新人入村的第一站，老村长阿降的家。',
    longDesc: '新手村。跟村长阿降学基础玩法，完成 5 个新手任务，建立你的初始 CV。这里有典籍阁、铁匠铺、阿降小屋——萌芽印记的成长起点。',
    highlights: ['村长阿降', '典籍阁', '铁匠铺', '5 新手任务'],
    xPct: 28,
    yPct: 60,
    available: true,
    sceneKey: 'Main',
    icon: '🌱',
    tone: 'spring',
    level: 'L0',
  },
  {
    id: 'sproutcity',
    name: '共创之都',
    region: 'L1+ · 贡献者中心',
    description: '九大工坊环绕中央喷泉广场。CUA 工作组的物理化身。',
    longDesc: '9 个工作组组成的协作网络。降噪 / 链接 / 共创 三大板块，每个工坊对应一类真实社区贡献。百晓居首席高粱在中央书院。',
    highlights: ['9 工坊', '百晓居 · 高粱', '5 真任务', '审核员'],
    xPct: 58,
    yPct: 35,
    available: true,
    sceneKey: 'SproutCity',
    icon: '🏛',
    tone: 'gold',
    level: 'L1+',
  },
  {
    id: 'zhengzheng',
    name: '议政高地',
    region: 'L2+ · 治理空间',
    description: '远见塔、执政厅、明镜阁——治理中心。',
    longDesc: '贡献者大会、监察委员会。攒够 CV 后参与提案、投票、申诉裁定。议长在此守候——持 CV 满千者，可上议政台。',
    highlights: ['远见塔 · 路线图', '执政厅 · 提案', '明镜阁 · 申诉', '议长'],
    xPct: 80,
    yPct: 20,
    available: true,
    sceneKey: 'GovHill',
    icon: '⚖',
    tone: 'jade',
    level: 'L2+',
  },
  {
    id: 'dasaiji',
    name: '大集会广场',
    region: '⏳ 敬请期待',
    description: '年度大会的舞台。平时空旷，活动时万人云集。',
    longDesc: '多人在场系统的核心场景——同屏 10+ 玩家、实时协作、年度大会舞台。当前未上线。',
    highlights: ['多人在场', '年度大会', '同屏 10+', '实时协作'],
    xPct: 50,
    yPct: 78,
    available: false,
    sceneKey: 'GrandPlaza',
    icon: '🎪',
    tone: '',
    level: '⏳',
  },
];
